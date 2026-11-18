// Modified for NA29 Islands by NA29: interface and behavior.
// Licensed under Apache-2.0; see LICENSE, NOTICE and THIRD_PARTY.md.
// Personal (my-workspaces): the Spaces list and the agents list in one. Each workspace
// is a btop/lazygit-style box: a flat 1px frame (neutral, or the workspace's color when
// it's the shown one) with its badge, name and git state set into the top edge on the
// left and its live agent counts on the right; its agents are listed inside. Built on
// my-spaces, so worktrees nest under their repo, machines group, the + asks for a name,
// right-click opens the space menu and dragging a box's top edge reorders.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, machines, panes, run, openOverlay, exec, hc, theme, shared, setShared, watchFolder, window, layout, agents, terminals, settings, setAgentOrder, readTextFile, appHome } from "herdr";

// Personal: cards and pills follow the Cards transparency slider (my-settings).
const glass = (c) => {
  const r = shared("rice") ?? {};
  const p = r["transparency.on"] === false ? 100 : (r["transparency.cards"] ?? 100);
  return p >= 100 || !/^#[0-9a-f]{6}$/i.test(c) ? c : c + Math.round((p / 100) * 255).toString(16).padStart(2, "0");
};

// Personal: every + here asks for the new space's name first (my-prompt), instead of
// making one called after its folder.
function newSpace(args = {}) {
  openOverlay({ mod: "my-prompt", kind: "dialog", width: 420, height: 210,
    props: { title: "New space", command: { name: "space.new", args } } });
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
const rowHeight = ({ tree }) => (tree ? 28 : 30);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;

// Personal: space badges. Theme colors (a stored name like "ansi6" is read from the
// theme, so Rosé Pine shows love/gold/rose/pine/foam/iris), a soft tinted tile with a
// colored letter, filled solid for the shown space; the home space (~) gets a house.
function tint(color, alpha) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color + Math.round(alpha * 255).toString(16).padStart(2, "0") : color;
}
function avatar(t, w, size = 20) {
  const home = w.name === "~";
  const stored = (shared("space.colors") ?? {})[w.id];
  const color = home ? t.ansi6 : !stored ? t.ansi6 : stored.startsWith("#") ? stored : (t[stored] ?? t.accent);
  const ink = w.active ? t.background : color;
  const tile = h_flex().size(size).flex_none().rounded(Math.round(size * 0.3)).items_center().justify_center()
    .when(w.active, (el) => el.bg(color))
    .when(!w.active, (el) => el.bg(tint(color, 0.16)).border_1().border_color(tint(color, 0.38)));
  return home
    ? tile.child(svg("mods/sleek-workspaces/home.svg").size(Math.round(size * 0.6)).text_color(ink))
    : tile.text_size(Math.round(size * 0.55)).font_bold().text_color(ink).child([...w.name][0]?.toUpperCase() ?? "?");
}

// Personal: Hyprland-style workspace numbers (Ctrl+1–9 jump by them). The number in Geist Mono
// and the workspace's own colour: bare for the others, on a filled tile for the shown one.
function numberBadge(t, w, i, size = 20) {
  const color = w.name === "~" ? t.ansi6 : (() => {
    const stored = (shared("space.colors") ?? {})[w.id];
    return !stored ? t.ansi6 : stored.startsWith("#") ? stored : (t[stored] ?? t.accent);
  })();
  return h_flex().size(size).flex_none().rounded(Math.round(size * 0.3)).items_center().justify_center()
    .font_family("Geist Mono").font_semibold().text_size(Math.round(size * 0.62))
    .when(w.active, (el) => el.bg(color).text_color(t.background))
    .when(!w.active, (el) => el.text_color(color))
    .child(String(i + 1));
}

// Personal: the workspace number as plain type (polybar/waybar style): zero-padded Geist Mono
// in the workspace's colour, full strength for the shown one, softened for the others.
function workspaceNumber(t, w, i) {
  const color = w.name === "~" ? t.ansi6 : (() => {
    const stored = (shared("space.colors") ?? {})[w.id];
    return !stored ? t.ansi6 : stored.startsWith("#") ? stored : (t[stored] ?? t.accent);
  })();
  return div().w(20).flex_none().font_family("Geist Mono").font_semibold().text_size(13)
    .text_color(w.active ? color : tint(color, 0.55)).child(String(i + 1).padStart(2, "0"));
}

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}


// ---- agents inside the boxes ------------------------------------------------------
// Font rule: words in Geist, numbers and code in Geist Mono (one family, designed together).
const MONO = () => "Geist Mono";
const SANS = "Geist";
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// Pets (local change): frame time of the baked loops, and how long idle keeps moving.
const PET_FRAME_MS = 125;
const IDLE_ANIM_MS = 30000;
const HOVER_ANIM_MS = 15000;
const PET_MIN_BUSY_MS = 3000;
function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}
const cleanTitle = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
function programIcon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}
// Blend two #rrggbb colors (a solid result, so cards stay opaque).
function mixHex(a, b, k) {
  if (!/^#[0-9a-f]{6}/i.test(a) || !/^#[0-9a-f]{6}/i.test(b)) return a;
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(ch(a, i) * (1 - k) + ch(b, i) * k).toString(16).padStart(2, "0")).join("");
}
function spaceTone(t, s) {
  if (!s || s.name === "~") return t.ansi6;
  const stored = (shared("space.colors") ?? {})[s.id];
  return !stored ? t.ansi6 : stored.startsWith("#") ? stored : (t[stored] ?? t.accent);
}
// The agent's session name from the title it gives its terminal (Claude "◑ Name",
// OpenCode "OC | Name", Codex with terminal_title = thread-name). Titles that say
// nothing fall back to a tab you named, else null ("untitled").
function sessionName(a, cwdOf, tabOf) {
  const raw = cleanTitle(a.title).replace(/^(OC|CC|Codex)\s*[|:·-]\s*/i, "").trim();
  const low = raw.toLowerCase();
  const folder = (cwdOf.get(a.pane) ?? "").split("/").filter(Boolean).pop()?.toLowerCase() ?? "";
  const said = [a.program?.name, a.program?.key, a.app].filter(Boolean).map((x) => x.toLowerCase());
  const generic = !raw || said.includes(low) || low === folder || /^[~/]/.test(raw) || raw.includes("@")
    || /^(claude( code)?|codex|open ?code|shell)$/.test(low) || /^new session\b/.test(low);
  if (!generic) return raw;
  const tab = tabOf.get(a.tab);
  return tab?.named ? tab.name : null;
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

export default class Spaces extends View {
  init(_props, cx) {
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Set(); // where()s to look at next
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Set(); // local repos' git folders
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.machines = [];
    this.reconnecting = JSON.parse(localStorage.getItem("machines.reconnecting") ?? "{}");
    for (const state of Object.values(this.reconnecting)) state.busy = false;
    this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]"));
    this.boxesFolded = new Set(JSON.parse(localStorage.getItem("boxes.folded") ?? "[]"));
    this.listFolded = localStorage.getItem("list.folded") === "1";
    // Each agent's last state and when it changed (ms), for "· 5m".
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    // Local change (glass-islands): BApet characters on the agents, and folded sub-agent trees.
    this.subFolded = new Set(JSON.parse(localStorage.getItem("sub.folded") ?? "[]"));
    this.pets = { pool: ["Mika"], byApp: {}, size: 56 };
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(`${appHome()}/mods/sleek-workspaces/pets.json`);
        if (text) { this.pets = { ...this.pets, ...JSON.parse(text) }; cx.notify(); }
      } catch {}
      // How many frames each character's loops have (pets/<Name>/meta.json, written by the bake).
      const names = new Set([...(this.pets.pool ?? []), ...Object.values(this.pets.byApp ?? {})]);
      for (const n of names) {
        try {
          const meta = JSON.parse(await readTextFile(`${appHome()}/mods/sleek-workspaces/pets/${n}/meta.json`) ?? "{}");
          this.petFrames[n] = meta.frames ?? {};
          this.petAspect[n] = meta.width && meta.height ? meta.width / meta.height : 1;
        } catch {}
      }
      cx.notify();
    });
    // Pets play their loops by swapping still frames 8 times a second, and only while one is
    // shown in a busy state: an animated image would keep the whole window redrawing nonstop.
    this.petFrames = {};
    this.petAspect = {};
    this.petTick = 0;
    this.petAnimating = false;
    this.petLast = {};    // address -> status at the last render
    this.petStopped = {}; // address -> when it went from working/blocked to done/idle (ms)
    this.petIdleAt = {};  // address -> when it went from done to idle (ms)
    this.petHover = {};   // address -> when the pointer last entered its pet (ms)
    this.petBusyFrom = {}; // address -> when it last became working/blocked (ms)
    cx.timer.every(PET_FRAME_MS, (cx) => { if (this.petAnimating) { this.petTick++; cx.notify(); } });
    cx.timer.every(30000, (cx) => cx.notify());
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // `git status` walks the whole tree, on another machine a process there:
    // only when its answer could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const due = this.due(now, sp, panes());
    if (due.size) this.refreshGit(due, cx);
    if (sp.some((s) => !this.shown.has(s.id)) || this.orderingDue(now)) cx.notify();
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      cx.notify();
    });
  }

  rebuilt(machine) {
    return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
  }

  reconnect(machine, cx) {
    const name = machine.name;
    if (this.reconnecting[name]?.busy) return;
    const state = this.reconnecting[name] ??= { machine, removed: false };
    state.busy = true;
    state.error = null;
    localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
    cx.notify();
    cx.spawn(async cx => {
      try {
        const ask = async args => {
          const r = await hc([...args, "--json"]);
          if (r.code !== 0) {
            let error;
            try { error = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
            throw new Error(error || r.stderr || r.stdout || "Couldn't connect.");
          }
        };
        if (!state.removed) {
          await ask(["machine", "rm", name]);
          state.removed = true;
          localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
        }
        const args = ["machine", "add"];
        if (machine.via) args.push("--via", machine.target);
        else args.push(machine.target);
        args.push("--name", name);
        if (machine.session) args.push("--session", machine.session);
        if (machine.temporary) args.push("--temp");
        await ask(args);
        this.folded.delete(name);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        delete this.reconnecting[name];
      } catch (e) {
        state.error = String(e.message ?? e);
        state.busy = false;
      }
      localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        for (const key of keys) await this.check(key, cx);
      }
      const used = new Set(Object.values(this.git).filter(Boolean).map((g) => JSON.parse(g.repo)).filter(([on]) => !on).map(([, repo]) => repo));
      for (const repo of this.watching) if (!used.has(repo)) this.watching.delete(repo);
      this.refreshing = false;
      cx.notify();
    });
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // No optional locks: a status that touched the index would wake the watch again.
      // Writes nothing under .git (index lock, fsmonitor cookie): watch() would wake on it.
      const r = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v2", "--branch"], { cwd, on });
      if (r.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.stderr)) this.unsure.add(key);
        this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
      const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on });
      const repo = common.stdout.trim();
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const info = { name, branch: null, ahead: 0, behind: 0, repo: JSON.stringify([on, repo]), linked: repo !== `${top.stdout.trim()}/.git` };
      for (const line of r.stdout.split("\n")) {
        if (line.startsWith("# branch.head ")) info.branch = line.slice(14);
        else if (line.startsWith("# branch.ab ")) {
          const [a, b] = line.slice(12).split(" ");
          info.ahead = Math.abs(parseInt(a, 10)) || 0;
          info.behind = Math.abs(parseInt(b, 10)) || 0;
        }
      }
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    this.watching.add(repo);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(repo)) {
          await watchFolder(repo);
          const mine = JSON.stringify([null, repo]);
          if (this.watching.has(repo)) this.refreshGit(Object.keys(this.git).filter((k) => this.git[k]?.repo === mine), cx);
        }
      } catch { this.watching.delete(repo); }
    });
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } });
  }

  orderingDue(now) {
    return this.ordering && now - this.ordering.at >= 1000
      && this.ordering.machines.every(name => machines().some(m => m.name === name && m.layout === "ready"));
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null }));
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    for (const r of list) {
      if (nested(r)) continue;
      out.push({ ...r, tree: null });
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
    }
    // Simulate the batch so later indexes include earlier moves. An attempted
    // write can lose a sync conflict: allow the echo to settle before retrying.
    const order = sp.map(w => w.id);
    const target = out.map(r => r.w.id);
    const key = JSON.stringify([order, target, machines()]);
    if (order.every((id, i) => id === target[i])) {
      this.ordering = null;
    } else if (this.ordering?.key !== key || this.orderingDue(Date.now())) {
      const moved = new Set();
      this.ordering = { key, at: Date.now(), machines: [] };
      for (let i = 0; i < out.length; i++) {
        const from = order.indexOf(out[i].w.id);
        if (from === i) continue;
        run("space.move", { id: out[i].w.id, index: i + 1 });
        moved.add(out[i].w.machine ?? null);
        order.splice(i, 0, order.splice(from, 1)[0]);
      }
      this.ordering.machines = [...moved];
    }
    return out.filter(r => this.shown.has(r.w.id));
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    const rows = this.ordered();
    const draw = (r) => (collapsed ? this.compact(r, t) : this.row(r, t));
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name), ...Object.keys(this.reconnecting)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => div().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(8).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length) return loading(null) && !rows.length ? [loadingRow(null)] : rows.map(draw);
    const machineNames = [null, ...remote];
    return machineNames.flatMap((m) => {
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const repair = this.reconnecting[m];
      const machine = this.machines.find(k => k.name === m) ?? repair?.machine;
      const connected = !m || machine?.state === "connected";
      const rebuilt = this.rebuilt(machine) || !!repair;
      const folded = this.folded.has(m);
      const head = h_flex().id(`machine-${m ?? "local"}`).h(26).flex_none().px(collapsed ? 2 : 8).gap(7).items_center().text_size(11).text_color(t.dim)
        .cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => {
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(13).flex_none())
        .when(!collapsed, el => el.child(div().flex_1().truncate().child(m ?? "This computer"))
          .when(!connected && !rebuilt, el => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
          .when(rebuilt, el => el.child(h_flex().flex_none().gap(3).items_center()
            .child(div().max_w(140).truncate().child(repair?.error || "rebuilt ·"))
            .child(div().id(`machine-connect-${m}`).text_color(repair?.error ? t.blocked : t.muted)
              .hover(s => s.text_color(t.foreground))
              .tooltip(repair?.error || "This machine was rebuilt or replaced. Click to connect to the new one.")
              .on_click((_e, cx) => { cx.stop_propagation(); this.reconnect(machine, cx); })
              .child(repair?.busy ? "Connecting…" : "Connect"))))
          .when(connected, el => el.child(div().id(`machine-add-${m ?? "local"}`).flex_none().px(4).rounded(4).hover(s => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); newSpace({ machine: m ?? "" }); }).child("+")))
          .child(div().size(6).rounded(3).flex_none().bg(connected ? t.ansi2 : t.dim))
          .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11).flex_none()));
      const empty = h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(8).gap(7).items_center().rounded(7)
        .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(() => newSpace({ machine: m ?? "" }))
        .child(svg("mods/workspace-chrome/plus.svg").size(12)).when(!collapsed, el => el.child("New space there"));
      if (!collapsed && rebuilt) return [head];
      return [head, ...(folded ? [] : mine.length ? mine.map(draw) : [loading(m) ? loadingRow(m) : empty])];
    });
  }

  // Only what's unusual, after the name: "herdr \u00b7 spike \u21912 \u21931". The repo or
  // branch goes when the name already says it (a worktree is named after its branch),
  // and master/main go: nearly every space is on one.
  gitTail(g, tree, name, t) {
    const raw = g.branch ?? "detached";
    const same = (a) => a.toLowerCase() === name.toLowerCase();
    const branch = same(raw) || raw === "master" || raw === "main" ? "" : raw;
    const repo = tree || same(g.name) ? "" : g.name;
    const where = [repo, branch].filter(Boolean).join(" \u00b7 ");
    return h_flex()
      .flex_1()
      .min_w(0)
      .gap(5)
      .justify_end()
      .items_center()
      .text_size(11.5)
      .text_color(t.dim)
      .when(Boolean(where), (el) => el.child(div().min_w(0).truncate().child(where)))
      .when(g.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`\u2191${g.ahead}`)))
      .when(g.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi1).child(`\u2193${g.behind}`)));
  }

  // Stamps agents whose state changed (done and idle count as one).
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const st = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === st) continue;
      this.changed[a.address] = { s: st, at: now };
      dirty = true;
    }
    if (dirty) localStorage.setItem("changed", JSON.stringify(this.changed));
  }

  agentStatus(t, st) {
    if (st === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900);
    if (st === "blocked") return div().size(14).flex_none().rounded(3).bg(t.blocked + "26").text_size(10).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (st === "done") return div().size(7).mx(3).flex_none().rounded(4).bg(t.done);
    if (st === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return div().size(7).mx(3).flex_none();
  }

  // ---- Local change (glass-islands) --------------------------------------------------
  // Each agent is a card with a BApet character whose animation follows its status
  // (pets/<Name>/<status>.webp, baked by tools/bake-pet.py), after herdr-retro's sprite cards.
  // Its sub-agents hang under it as a tree, after herdr-orca's sidebar.
  petFor(a) {
    const cfg = this.pets ?? {};
    const byApp = cfg.byApp ?? {};
    const key = [a.app, a.program?.key, (a.program?.name ?? "").toLowerCase()].find((k) => k && byApp[k]);
    if (key) return byApp[key];
    const pool = (cfg.pool ?? []).length ? cfg.pool : ["Mika"];
    let h = 0;
    for (const ch of a.address) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return pool[h % pool.length];
  }

  // What the pet plays, from the status and a short history per agent:
  //   working / blocked     their loop
  //   just stopped          the victory, once (Herdr often skips "done": a focused agent goes
  //                         straight to idle), then the idle loop for IDLE_ANIM_MS. A busy spell
  //                         shorter than PET_MIN_BUSY_MS is a flicker and doesn't count.
  //   done / idle           the idle loop for IDLE_ANIM_MS after done became idle, or for
  //                         HOVER_ANIM_MS after the pointer enters the card; else a still frame
  petImage(name, st, address) {
    const dir = `mods/sleek-workspaces/pets/${name}`;
    const frames = this.petFrames?.[name] ?? {};
    const frame = (anim, i) => {
      this.petAnimating = true;
      return `${dir}/frames/${anim}/${String(i % frames[anim]).padStart(3, "0")}.png`;
    };
    const now = Date.now();
    const last = this.petLast[address];
    this.petLast[address] = st;
    const busy = (s) => s === "working" || s === "blocked";
    if (busy(st)) {
      if (!busy(last)) this.petBusyFrom[address] = now;
      return frames[st] ? frame(st, this.petTick) : `${dir}/still.png`;
    }
    if (busy(last) && now - (this.petBusyFrom[address] ?? 0) >= PET_MIN_BUSY_MS) {
      this.petStopped[address] = now;
      delete this.petIdleAt[address];
    }
    if (last === "done" && st === "idle") this.petIdleAt[address] = now;
    const stopped = this.petStopped[address];
    const victory = (frames.done ?? 0) * PET_FRAME_MS;
    if (stopped != null && now - stopped < victory) return frame("done", Math.floor((now - stopped) / PET_FRAME_MS));
    const from = Math.max(stopped != null ? stopped + victory : 0, this.petIdleAt[address] ?? 0);
    const hovered = now - (this.petHover[address] ?? 0) < HOVER_ANIM_MS;
    if (frames.idle && (now - from < IDLE_ANIM_MS || hovered)) return frame("idle", this.petTick);
    return `${dir}/still.png`;
  }

  petBox(t, a, size) {
    const st = ["working", "blocked", "done", "idle"].includes(a.status) ? a.status : "idle";
    const color = st === "idle" ? (t.idle ?? t.dim) : tone(t, st);
    const name = this.petFor(a), w = Math.round(size * (this.petAspect?.[name] ?? 1));
    const src = this.petImage(name, st, a.address);
    return div().id(`pet-${a.address}`).relative().size(size).flex_none().rounded(9).overflow_hidden()
      .bg(tint(color, st === "idle" ? 0.06 : 0.12)).border_1().border_color(tint(color, st === "idle" ? 0.18 : 0.45))
      .on_hover((on, cx) => { if (on) { this.petHover[a.address] = Date.now(); cx.notify(); } })
      // A still frame costs no redraws; anything else plays its baked 8 fps loop (petImage).
      // Full height at the frame's own proportions, centered (a wide weapon may run past the edges).
      .child(image(src).absolute().top(0).left(Math.round((size - w) / 2)).w(w).h(size))
      // Idle and asleep: a sleepy "z" in the corner, like herdr-retro.
      .when(st === "idle" && src.endsWith("/still.png"), (el) => el.child(div().absolute().top(2).right(4).text_size(10).font_bold().text_color(t.dim)
        .opacity(0.7).child("z")))
      .when(st === "blocked", (el) => el.child(div().absolute().top(2).right(3).size(14).rounded(3).bg(t.blocked)
        .text_size(10).font_bold().text_color(t.background).flex().items_center().justify_center()
        .child("!")));
  }

  badge(t, st) {
    const label = { working: "WORKING", blocked: "NEEDS YOU", done: "DONE", idle: "IDLE" }[st] ?? "IDLE";
    const color = st === "idle" ? t.muted : tone(t, st);
    return div().flex_none().h(15).px(5).flex().items_center().rounded(4).border_1().border_color(tint(color, 0.55))
      .bg(tint(color, 0.08)).text_size(9.5).font_bold().text_color(color).child(label);
  }

  subStatus(k) {
    const s = k.status;
    return s === "error" ? "blocked" : ["working", "blocked", "done", "idle"].includes(s) ? s : "idle";
  }

  kidsOf(ctx, address) {
    return ctx.all.filter((k) => k.parent === address && k.state === "live");
  }

  // Every live descendant, for the folded summary.
  descendants(ctx, address, out = []) {
    for (const k of this.kidsOf(ctx, address)) { out.push(k); this.descendants(ctx, k.address, out); }
    return out;
  }

  // Sub-agent rows on tree lines, any depth: a pane of its own gets focus, else a peek.
  subRows(t, ctx, address, rails) {
    const kids = this.kidsOf(ctx, address);
    return kids.flatMap((k, n) => {
      const last = n === kids.length - 1;
      const st = this.subStatus(k);
      const pane = ctx.paneOf.get(k.address);
      const when = this.changed[k.address]?.at;
      const name = k.name || k.template || k.program?.name || k.agent || k.address;
      const row = h_flex().id(`sub-${k.address}`).h(24).flex_none().pl(10).pr(8).gap(6).items_center().rounded(6)
        .font_family(ctx.mono).text_size(11).text_color(st === "idle" ? t.dim : t.muted).cursor_pointer()
        .hover((el) => el.bg(tint(t.foreground, 0.04)).text_color(t.foreground))
        .on_click(() => pane ? run("pane.focus", { pane }) : run("terminal.peek", { terminal: k.address }))
        .child(div().flex_none().text_color(t.border).child(rails + (last ? "└─" : "├─")))
        .child(h_flex().w(14).flex_none().justify_center().child(this.agentStatus(t, st)))
        .child(div().flex_1().min_w(0).truncate().font_family(SANS).child(name))
        .when(st === "blocked", (el) => el.child(div().flex_none().text_size(9.5).font_bold().text_color(t.blocked).child("Needs you")))
        .when(Boolean(when), (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child(duration(ctx.now - when))));
      return [row, ...this.subRows(t, ctx, k.address, rails + (last ? "   " : "│  "))];
    });
  }

  agentRow(t, a, ctx) {
    const name = sessionName(a, ctx.cwdOf, ctx.tabOf);
    const tabIndex = ctx.tabOf.get(a.tab)?.index;
    const when = this.changed[a.address]?.at;
    const prog = (a.program?.name ?? a.app ?? "agent").toLowerCase();
    const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
    const quiet = a.status === "idle" && !a.focused;
    const size = Number(this.pets?.size) || 56;
    const all = this.descendants(ctx, a.address);
    const folded = this.subFolded.has(a.address);
    const urgent = all.map((k) => this.subStatus(k)).sort((x, y) => (RANK[y] ?? 0) - (RANK[x] ?? 0))[0];
    // A folded sub-agent that needs you makes its parent say so, so folding never hides it.
    const st = folded && urgent === "blocked" ? "blocked" : a.status;
    const fold = (_e, cx) => {
      cx.stop_propagation();
      folded ? this.subFolded.delete(a.address) : this.subFolded.add(a.address);
      localStorage.setItem("sub.folded", JSON.stringify([...this.subFolded]));
      cx.notify();
    };
    const card = h_flex().id(`ag-${a.address}`).flex_none().p(5).pr(8).gap(9).items_center().rounded(9).cursor_pointer()
      .when(a.focused, (h) => h.bg(glass(t.selected)))
      .when(!a.focused, (h) => h.hover((x) => x.bg(tint(t.foreground, 0.04))))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .on_mouse_down("right", () => run("terminal.pin", { terminal: a.address, pinned: !a.pinned }))
      .child(this.petBox(t, { ...a, status: st }, size))
      .child(v_flex().flex_1().min_w(0).gap(4)
        .child(name
          ? div().w_full().truncate().text_size(12.5).text_color(quiet ? t.muted : t.foreground).font_semibold().child(name)
          : div().w_full().truncate().text_size(12.5).italic().text_color(t.dim).child("untitled"))
        .child(h_flex().w_full().min_w(0).gap(5).items_center().font_family(ctx.mono).text_size(10.5).text_color(t.dim)
          .when(Boolean(a.program?.icon), (el) => el.child(programIcon(a.program, 12, t.muted)))
          .child(div().flex_none().child(prog))
          .when(tabIndex != null, (el) => el.child(div().flex_none().child(`· tab ${tabIndex}`)))
          .when(Boolean(machine), (el) => el.child(div().flex_none().text_color(t.muted).child(`@${machine}`))))
        .child(h_flex().gap(6).items_center()
          .child(this.badge(t, st))
          .when(Boolean(when), (el) => el.child(div().flex_none().font_family(ctx.mono).text_size(10).text_color(t.dim).child(duration(ctx.now - when))))
          .when(a.pinned, (el) => el.child(div().flex_none().text_size(10).text_color(t.accent).child("pinned")))))
      .when(all.length > 0, (el) => el.child(h_flex().id(`subfold-${a.address}`).flex_none().gap(3).p(3).items_center().rounded(5)
        .text_color(t.dim).hover((h) => h.bg(t.hover).text_color(t.foreground))
        .tooltip(folded ? "Show sub-agents" : "Hide sub-agents")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click(fold)
        .when(folded, (h) => h.child(div().font_family(ctx.mono).text_size(10.5).text_color(urgent && urgent !== "idle" ? tone(t, urgent) : t.dim).child(String(all.length))))
        .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11))));
    return [v_flex().id(`agbox-${a.address}`).flex_none().child(card).children(folded ? [] : this.subRows(t, ctx, a.address, ""))];
  }

  // How many agents are in each state, most urgent first, each with the same mark the
  // rows use (a spinner, a red !, a filled dot, a ring) so the edge and the rows agree.
  counts(t, mine) {
    const n = (st) => mine.filter((a) => a.status === st).length;
    const mark = (st) => st === "working" ? svg("mods/workspace-chrome/spinner.svg").size(10).flex_none().text_color(t.working).spin(900)
      : st === "blocked" ? div().flex_none().font_bold().text_color(t.blocked).child("!")
      : st === "done" ? div().size(6).flex_none().rounded(3).bg(t.done)
      : div().size(6).flex_none().rounded(3).border(1.2).border_color(t.idle ?? t.dim);
    return ["blocked", "working", "done", "idle"]
      .filter((st) => n(st) > 0)
      .map((st) => h_flex().flex_none().gap(4).items_center().child(mark(st))
        .child(div().text_color(st === "idle" ? t.dim : t.muted).child(String(n(st)))));
  }

  // Sleek experiment: each workspace is a soft card (pane background, no border). Its header row
  // is the handle: click to show the workspace, drag onto another to reorder, right-click for
  // its menu, the chevron folds it. The shown workspace's card is a little brighter.
  row({ w, i, g, tree }, t) {
    const ctx = this.ctx;
    const on = w.active;
    const mine = ctx.bySpace.get(w.id) ?? [];
    const open = !this.boxesFolded.has(w.id);
    const fromIndex = this.pressed === null ? -1 : spaces().findIndex(s => s.id === this.pressed);
    const rawBranch = g ? (g.branch ?? "detached") : null;
    const branch = rawBranch && rawBranch !== "main" && rawBranch !== "master" && rawBranch.toLowerCase() !== w.name.toLowerCase() ? rawBranch : null;

    // Hovering the title brightens it (no nested highlight inside the card).
    const head = h_flex().id(`space-${w.id}`).h(32).px(8).gap(8).items_center().rounded(7).cursor_pointer()
      .text_color(on ? t.foreground : t.muted)
      .hover((h) => h.text_color(t.foreground))
      .on_mouse_down("left", () => {
        this.pressed = w.id;
        this.over = w.id;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces().find(s => s.id === this.pressed);
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? w.id : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === w.id && from !== w.id) {
          const index = spaces().findIndex(s => s.id === w.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        } else if (from === w.id) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      .when(Boolean(tree), (el) => el.child(div().text_color(t.dim).child("↳")))
      .child(workspaceNumber(t, w, i))
      // Workspace names are headings: semibold everywhere (agent titles stay regular); the shown one is bright.
      .child(div().flex_shrink_1().min_w(0).truncate().font_family(SANS).text_size(13.5)
        .font_semibold().text_color(on ? t.foreground : t.muted).child(w.name))
      .when(Boolean(branch), (el) => el.child(div().flex_shrink_1().min_w(0).max_w(90).truncate().font_family(ctx.mono).text_size(10.5).text_color(t.dim).child(`⎇ ${branch}`)))
      .when((g?.ahead ?? 0) > 0, (el) => el.child(div().font_family(ctx.mono).text_size(10.5).text_color(t.ansi2).child(`↑${g.ahead}`)))
      .when((g?.behind ?? 0) > 0, (el) => el.child(div().font_family(ctx.mono).text_size(10.5).text_color(t.ansi1).child(`↓${g.behind}`)))
      .child(div().flex_1())
      // Folded: every status with its count. Open: only what's urgent (the rows show the rest).
      .when(!open, (el) => el.child(h_flex().flex_none().gap(8).items_center().font_family(ctx.mono).text_size(11).children(this.counts(t, mine))))
      .when(open, (el) => el.child(h_flex().flex_none().gap(8).items_center().font_family(ctx.mono).text_size(11)
        .children(this.counts(t, mine.filter((a) => a.status === "blocked" || a.status === "working")))))
      .child(div().id(`fold-${w.id}`).flex_none().p(2).rounded(4).cursor_pointer()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => {
          cx.stop_propagation();
          open ? this.boxesFolded.add(w.id) : this.boxesFolded.delete(w.id);
          localStorage.setItem("boxes.folded", JSON.stringify([...this.boxesFolded]));
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(12)));

    const body = mine.length
      ? v_flex().pt(1).gap(6).children(mine.flatMap((a) => this.agentRow(t, a, ctx)))
      : h_flex().id(`empty-${w.id}`).h(26).px(10).items_center().rounded(6).cursor_pointer()
          .font_family(SANS).text_size(11.5).text_color(t.dim)
          .hover((el) => el.bg(tint(t.foreground, 0.04)).text_color(t.muted))
          .on_click(() => run("space.select", { id: w.id }))
          .child(`No agents · ${w.tabs.length} tab${w.tabs.length === 1 ? "" : "s"}`);

    // Cards use the terminal panes' own background, so the window has only two surface colors;
    // the shown workspace stands out by its filled badge and brighter name.
    return v_flex().relative().w_full().flex_none().mt(6).p(4).rounded(10)
      // The shown workspace's card carries a faint wash of the accent ("you are here").
      .bg(glass(on ? mixHex(t.background, t.accent, 0.07) : t.background))
      .when(Boolean(tree), (el) => el.ml(14))
      .when(this.pressed === w.id && this.over !== w.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === w.id && this.pressed !== w.id, (el) => el.child(
        div().absolute().left(8).right(8).h(2).rounded(1).bg(t.accent)
          .when(fromIndex < i, (line) => line.bottom(-4))
          .when(fromIndex > i, (line) => line.top(-4)),
      ))
      .child(head)
      .when(open, (el) => el.child(body));
  }

  // Narrow sidebar (rail): the workspace's badge, centred; the shown one sits on the same faint
  // accent tile as its card; a corner dot tells what its agents are doing.
  compact({ w, i }, t) {
    const dot = w.status === "blocked" ? t.blocked : w.status === "done" ? t.done : w.status === "working" ? t.working : null;
    return div().id(`space-${w.id}`).relative().w_full().h(40).flex_none().flex().items_center().justify_center()
      .cursor_pointer().tooltip(w.name)
      .on_click(() => run("space.select", { id: w.id }))
      .on_mouse_down("right", () => this.menu(w))
      .child(div().relative().size(36).flex().items_center().justify_center().rounded(9)
        .when(w.active, (el) => el.bg(glass(mixHex(t.background, t.accent, 0.07))))
        .when(!w.active, (el) => el.hover((h) => h.bg(tint(t.foreground, 0.05))))
        .child(numberBadge(t, w, i, 24))
        .when(Boolean(dot), (el) => el.child(div().absolute().right(3).bottom(3).size(8).rounded(4).bg(dot)
          .border_1().border_color(t.chrome))));
  }


  render() {
    const t = theme();
    const collapsed = narrow();
    this.petAnimating = false;
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const sp = spaces();
    const ids = new Set(sp.map(p => p.id));
    const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = c => Object.values(kept).filter(v => v === c).length;
      kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
      changed = true;
    }
    if (changed) setShared("space.colors", kept);

    // Agents per workspace, most urgent first, then most recently changed.
    const now = Date.now();
    const allTerms = terminals();
    const live = new Set(allTerms.filter((k) => k.state === "live").map((k) => k.address));
    const parentOf = new Map(allTerms.map((k) => [k.address, k.parent]));
    // A sub-agent is listed under its parent only (herdr-orca), not as an agent of its own.
    const list = agents().filter((a) => !(parentOf.get(a.address) && live.has(parentOf.get(a.address))));
    this.track([...list, ...allTerms.filter((k) => k.parent && k.state === "live").map((k) => ({ address: k.address, status: this.subStatus(k) }))], now);
    const order = new Map(sp.map((s, n) => [s.id, n]));
    const since = (a) => this.changed[a.address]?.at ?? 0;
    const sorted = [...list].sort((x, y) => (order.get(x.space) ?? 0) - (order.get(y.space) ?? 0)
      || (RANK[y.status] ?? 0) - (RANK[x.status] ?? 0) || since(y) - since(x));
    const bySpace = new Map();
    for (const a of sorted) bySpace.set(a.space, [...(bySpace.get(a.space) ?? []), a]);
    setAgentOrder(sorted.map((a) => a.address));
    this.ctx = {
      now, bySpace, mono: MONO(), all: allTerms,
      paneOf: new Map(panes().filter((p) => p.terminal).map((p) => [p.terminal, p.pane])),
      cwdOf: new Map(panes().map((p) => [p.pane, p.cwd ?? ""])),
      tabOf: new Map(sp.flatMap((s) => s.tabs).map((tab) => [tab.id, tab])),
    };
    const needs = list.filter((a) => a.status === "blocked").length;
    const busy = list.filter((a) => a.status === "working").length;
    const plus = div().id("space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6)
      .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .tooltip("New space").on_click((_e, cx) => { cx.stop_propagation(); newSpace(); }).child(svg("mods/workspace-chrome/plus.svg").size(14));
    return v_flex().size_full().min_h(0).text_size(13)
      // Click the header to fold the whole list away (remembered).
      .child(h_flex().id("ws-head").h(34).pl(14).pr(8).gap(8).items_center().flex_none().font_family(MONO()).text_size(11)
        .when(!collapsed, el => el.cursor_pointer()
          .on_click((_e, cx) => {
            this.listFolded = !this.listFolded;
            localStorage.setItem("list.folded", this.listFolded ? "1" : "0");
            cx.notify();
          })
          .child(div().font_family(SANS).text_size(12).text_color(t.muted).font_semibold().child("Workspaces"))
          .child(div().h(16).px(6).flex().items_center().rounded(8).bg(tint(t.foreground, 0.06)).text_color(t.dim).child(`${sp.length}`))
          .child(svg(`mods/workspace-chrome/chevron-${this.listFolded ? "right" : "down"}.svg`).size(12).text_color(t.dim))
          .child(div().flex_1())
          .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`${needs} need you`)))
          .when(busy > 0, el => el.child(div().text_color(t.working).child(`${busy} busy`))))
        // Rail: a button to widen the sidebar again, above the +.
        .when(collapsed, el => el.flex_col().h(64).py(4).gap(2).justify_center()
          .child(div().id("rail-expand").size(26).flex_none().flex().items_center().justify_center().rounded(6)
            .text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip("Expand sidebar")
            .on_click(() => {
              setShared("sidebar.collapsed", false);
              run("layout.resize", { id: "sidebar", px: shared("sidebar.width") ?? 268 });
            })
            .child(svg("mods/workspace-chrome/sidebar.svg").size(15))))
        .child(plus))
      .child(v_flex().flex_1().min_h(0).px(8).pb(14).overflow_y_scrollbar().mode("always")
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); })
        .children(this.listFolded && !collapsed ? [] : this.grouped(t, collapsed)));
  }
}
