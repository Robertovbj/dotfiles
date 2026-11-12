#!/usr/bin/env python3
"""Bake a BApet (Blue Archive) .glb model into small sprites for Herdr's agent cards.

Herdr mods can't draw 3D, so this renders the model offline, once, with BApet's own
renderer and writes plain image files that the sidebar just plays:

  still.png               idle (a still frame: no animation, no CPU)
  frames/working/NNN.png  a loop: attack start -> N shots (the magazine) -> reload -> again,
                          turned to shoot to the right, reloading turned partway back
  frames/blocked/NNN.png  a loop (panic)
  frames/done/NNN.png     a loop (victory)
  frames/idle/NNN.png     a loop (the idle clip; played for a while after the agent stops,
                          and on hover; still.png is its first frame)
  meta.json               frame counts, read by the sidebar

The sidebar swaps the frames itself, 8 a second, only while an agent is busy. (An animated
WebP/GIF would be simpler, but Herdr then redraws the whole window nonstop: ~4x the CPU.)

Run it with BApet's venv:

  ~/.local/share/bapet/venv/bin/python -I ~/.config/herdr-app/tools/bake-pet.py Mika
  ~/.local/share/bapet/venv/bin/python -I ~/.config/herdr-app/tools/bake-pet.py Mika --list   # its animations

Per character settings live in mods/sleek-workspaces/pets/<Name>/bake.json (made with
the defaults on the first run; edit it and bake again):

  mag          shots per magazine before reloading
  aim_yaw      degrees to turn while shooting (90 = shoots to the right)
  reload_yaw   degrees while reloading (45 = turned halfway back toward you)
  anims        animation names per part: start, shot, reload, blocked, done, idle
"""

from __future__ import annotations

import json
import math
import shutil
import sys
from pathlib import Path

BAPET_SRC = Path.home() / ".local/share/bapet/src"
MODELS_DIR = Path.home() / ".local/share/bluearchive-desktop-pet/models"
OUT_ROOT = Path.home() / ".config/herdr-app/mods/sleek-workspaces/pets"
BAPET_SETTINGS = Path.home() / ".config/bluearchive-desktop-pet/settings.json"

sys.path.insert(0, str(BAPET_SRC))

import numpy as np  # noqa: E402
from PySide6.QtGui import QImage  # noqa: E402

from bapet import gltf  # noqa: E402
from bapet.models import decode_image  # noqa: E402
from bapet.renderer import Frame, Renderer, decode_textures  # noqa: E402

FPS = 8  # low on purpose: every new frame redraws the Herdr window
HEIGHT_PX = 240  # render height before the crop; the card shows ~100 px, so it stays sharp
PITCH_DEG = -5.0
OUTLINE_PX = 0.1  # same as the desktop pets' wrapper
BLEND_S = 0.15  # pose crossfade between clips
TURN_S = 0.35  # time to turn to a new angle
MAX_LOOP_S = 6.0  # blocked/done/idle clips are cut to this

DEFAULTS = {
    "mag": 5,
    "aim_yaw": 90,
    "reload_yaw": 45,
    "anims": {
        "start": ["Normal_Attack_Start"],
        "shot": ["Normal_Attack_Ing"],
        "reload": ["Normal_Reload"],
        "blocked": ["Vital_Panic", "Cafe_Reaction", "Normal_Callsign"],
        "done": ["Victory_Start", "Victory_End", "Cafe_Reaction"],
        "idle": ["Cafe_Idle", "Normal_Idle", "Formation_Idle"],
    },
}
# Known magazines, used when a character's bake.json doesn't exist yet.
MAGS = {
    "Mika": 5, "Kei": 5, "Rena": 5, "Hikari": 6, "Hifumi": 5,
    "Momiji": 1, "Chise": 6, "Yuuka": 9, "Mutsuki": 15,
}

try:  # same camera pitch as the desktop pets
    PITCH_DEG = float(json.loads(BAPET_SETTINGS.read_text()).get("pitch_deg", PITCH_DEG))
except Exception:
    pass


def smooth(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def load_config(name: str, out: Path) -> dict:
    path = out / "bake.json"
    if not path.exists():
        cfg = json.loads(json.dumps(DEFAULTS))
        cfg["mag"] = MAGS.get(name, DEFAULTS["mag"])
        path.write_text(json.dumps(cfg, indent=2) + "\n")
        return cfg
    cfg = json.loads(path.read_text())
    merged = json.loads(json.dumps(DEFAULTS))
    merged.update({k: v for k, v in cfg.items() if k != "anims"})
    for k, v in (cfg.get("anims") or {}).items():
        merged["anims"][k] = [v] if isinstance(v, str) else list(v)
    return merged


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    name = args[0] if args else "Mika"
    path = MODELS_DIR / f"{name}.glb"
    if not path.exists():
        sys.exit(f"no model at {path}")
    if "--list" in sys.argv:  # just print the model's animations (name and seconds)
        for i, a in enumerate(gltf.load_file(str(path)).animations):
            print(f"{i:3d}  {a.name}  {a.duration:.2f}s")
        return
    out = OUT_ROOT / name
    out.mkdir(parents=True, exist_ok=True)
    cfg = load_config(name, out)

    model = gltf.load_file(str(path))
    textures = decode_textures(model, decode_image)
    renderer = Renderer()
    gpu = renderer.upload(model, textures)

    def anim(part: str) -> int:
        idx = model.find_animation(*cfg["anims"][part])
        if idx is None:
            idx = model.find_animation(*DEFAULTS["anims"]["idle"]) or 0
            print(f"  {part}: none of {cfg['anims'][part]} found, using {model.animations[idx].name}")
        return idx

    def dur(idx: int) -> float:
        return max(model.animations[idx].duration, 1.0 / FPS)

    aim, back = float(cfg["aim_yaw"]), float(cfg["reload_yaw"])
    start, shot, reload = anim("start"), anim("shot"), anim("reload")
    blocked, done, idle = anim("blocked"), anim("done"), anim("idle")
    # Each sequence is a list of (animation, seconds, yaw degrees); it loops back to its start.
    sequences = {
        "working": [(start, dur(start), aim)] + [(shot, dur(shot), aim)] * int(cfg["mag"]) + [(reload, dur(reload), back)],
        "blocked": [(blocked, min(dur(blocked), MAX_LOOP_S), 0.0)],
        "done": [(done, min(dur(done), MAX_LOOP_S), 0.0)],
        "idle": [(idle, min(dur(idle), MAX_LOOP_S), 0.0)],
    }
    for k, seq in sequences.items():
        print(f"{k:8s} -> " + " > ".join(f"{model.animations[i].name}@{y:g}°" for i, _, y in seq))

    # One framing for every clip, so the character doesn't jump between statuses. The radius is
    # around the vertical axis, so it holds for any yaw.
    used = {idle} | {i for seq in sequences.values() for i, _, _ in seq}
    radius, y_min, y_max = 0.0, 0.0, 0.0
    for idx in used:
        r, lo, hi = model.animation_bounds(model.bake(idx))
        radius, y_min, y_max = max(radius, r), min(y_min, lo), max(y_max, hi)
    pitch = math.radians(PITCH_DEG)
    c, s_ = math.cos(pitch), math.sin(pitch)
    span = (y_max * c + radius * s_) - (min(y_min, 0.0) * c - radius * s_)
    ppu = HEIGHT_PX / max(span, 1e-6)
    frame = Frame.fit(radius, y_min, y_max, ppu, pitch, int(math.ceil(OUTLINE_PX)) + 3)

    # Frames are kept in memory and written at the end, all cropped to the same box: the
    # pixels actually drawn across every frame. The geometric bounds can be far too big (some
    # models carry hidden props below the floor or far away), which left the character small
    # and off-center. The box is symmetric around the model's origin horizontally, so the body
    # stays centered while a weapon reaches out to one side.
    pending: list[tuple[Path, np.ndarray]] = []

    def save(world, weights, yaw_deg: float, file: Path) -> None:
        _, _, rgba = renderer.render(gpu, world, weights, frame, math.radians(yaw_deg), 1.0, OUTLINE_PX)
        pending.append((file, rgba))

    def write_all() -> tuple[int, int]:
        drawn = np.zeros(pending[0][1].shape[:2], dtype=bool)
        for _, rgba in pending:
            drawn |= rgba[:, :, 3] > 8
        ys, xs = np.nonzero(drawn)
        h, w = drawn.shape
        if len(xs) == 0:
            y0, y1, x0, x1 = 0, h, 0, w
        else:
            pad = 2
            y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + 1 + pad)
            half = max(frame.anchor_x - xs.min(), xs.max() + 1 - frame.anchor_x) + pad
            x0, x1 = max(0, int(math.floor(frame.anchor_x - half))), min(w, int(math.ceil(frame.anchor_x + half)))
        for file, rgba in pending:
            crop = np.ascontiguousarray(rgba[y0:y1, x0:x1])
            cw, ch = x1 - x0, y1 - y0
            img = QImage(crop.tobytes(), cw, ch, cw * 4, QImage.Format.Format_RGBA8888_Premultiplied)
            img.convertToFormat(QImage.Format.Format_RGBA8888).save(str(file))
        return int(x1 - x0), int(y1 - y0)

    def pose_at(seq, j: int, t: float):
        idx, length, _ = seq[j]
        return model.bake(idx).sample(min(t, length), len(seq) == 1)

    counts: dict[str, int] = {}
    try:
        world, weights = model.bake(idle).sample(0.0, True)
        save(world, weights, 0.0, out / "still.png")

        for status, seq in sequences.items():
            total = sum(length for _, length, _ in seq)
            count = max(1, int(round(total * FPS)))
            fdir = out / "frames" / status
            shutil.rmtree(fdir, ignore_errors=True)
            fdir.mkdir(parents=True)
            starts = [sum(length for _, length, _ in seq[:j]) for j in range(len(seq))]
            for i in range(count):
                t = i / FPS
                j = max(k for k in range(len(seq)) if starts[k] <= t)
                local = t - starts[j]
                world, weights = pose_at(seq, j, local)
                yaw = seq[j][2]
                p = (j - 1) % len(seq)  # the clip before (for the first: the last one, a seamless loop)
                if len(seq) > 1 and local < BLEND_S:
                    pw, pweights = pose_at(seq, p, seq[p][1])
                    k = smooth(local / BLEND_S)
                    world = pw + (world - pw) * k
                    weights = dict(weights)
                    for n, wv in pweights.items():
                        if n in weights and len(weights[n]) == len(wv):
                            weights[n] = wv + (weights[n] - wv) * k
                if len(seq) > 1 and seq[p][2] != yaw and local < TURN_S:
                    yaw = seq[p][2] + (yaw - seq[p][2]) * smooth(local / TURN_S)
                save(world, weights, yaw, fdir / f"{i:03d}.png")
            counts[status] = count
        width, height = write_all()
        for old in ("idle.webp", "working.webp", "blocked.webp", "done.webp", "idle.gif", "working.gif", "blocked.gif", "done.gif", "anims.json"):
            (out / old).unlink(missing_ok=True)
        (out / "meta.json").write_text(json.dumps({
            "model": name, "width": width, "height": height, "fps": FPS, "frames": counts,
            "sequences": {s: [[model.animations[i].name, round(n, 2), y] for i, n, y in seq] for s, seq in sequences.items()},
            "idle": model.animations[idle].name,
        }, indent=2) + "\n")
        print(f"wrote {out} ({width}x{height}, {FPS} fps)")
    finally:
        gpu.release()
        renderer.release()


if __name__ == "__main__":
    main()
