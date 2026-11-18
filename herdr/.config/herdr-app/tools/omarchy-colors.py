#!/usr/bin/env python3
"""Paint the glass-islands layout with the current Omarchy theme.

Herdr already follows Omarchy for its theme (themes/omarchy.json, written by Omarchy on every
theme change, picked in Herdr's theme menu). What it can't follow by itself are the colors the
layout file sets directly, because they carry transparency over the wallpaper:

  dim         the veil over the wallpaper
  islands     sidebar, tab bar, side panels, status bar (translucent cards)
  panes       the terminal frames
  colors      root theme overrides (dim, muted, accent text)

This rewrites those fields from ~/.local/state/omarchy/current/theme/colors.toml. Herdr reloads
the layout file by itself. A theme listed in PINS gets exactly those values instead (Catppuccin
keeps the look it was tuned with); any other theme gets them derived from its palette, and no
overrides in `colors`, so Herdr's own omarchy theme decides text and accent.

Run by the Omarchy hook ~/.config/omarchy/hooks/theme-set.d/30-herdr-glass after every
`omarchy theme set`; run it by hand to repaint now. `--theme <name>` previews another installed
theme without switching Omarchy.
"""

from __future__ import annotations

import json
import os
import sys
import tomllib
from pathlib import Path

HOME = Path(os.environ.get("HERDR_APP_HOME", Path.home() / ".config/herdr-app"))
LAYOUT = HOME / "layouts/glass-islands.json"
STATE = Path.home() / ".local/state/omarchy/current"
THEME_DIRS = [Path.home() / ".config/omarchy/themes", Path("/usr/share/omarchy/themes")]

ISLANDS = ["sidebar", "tabs", "panel", "herdsidian", "status"]

# Exact values per Omarchy theme name, kept as they were tuned. Everything not here is derived.
PINS = {
    "catppuccin": {
        "dim": "#0000008c",
        "island": "#16141fb3",
        "pane": "#191724cc",
        "colors": {"dim": "#8a86a3", "muted": "#aaa6c3", "accent": "#eb6f92"},
    },
}


def derive(c: dict) -> dict:
    """Same opacities as the pinned look, colors from the palette."""
    rgb = lambda k, fallback: (c.get(k) or c.get(fallback) or "#000000")[:7].lower()
    if c.get("mode") == "light":
        dim = rgb("background", "background") + "8c"  # wash the wallpaper toward the page color
    else:
        dim = "#0000008c"
    return {
        "dim": dim,
        "island": rgb("dark_background", "background") + "b3",
        "pane": rgb("background", "background") + "cc",
        "colors": {},
    }


def find(node, id_):
    if isinstance(node, dict):
        if node.get("id") == id_:
            return node
        for child in node.get("children") or []:
            hit = find(child, id_)
            if hit:
                return hit
    return None


def main() -> None:
    args = sys.argv[1:]
    if "--theme" in args:
        name = args[args.index("--theme") + 1]
        src = next((d / name / "colors.toml" for d in THEME_DIRS if (d / name / "colors.toml").exists()), None)
        if not src:
            sys.exit(f"no theme {name!r} in {', '.join(map(str, THEME_DIRS))}")
    else:
        name = (STATE / "theme.name").read_text().strip() if (STATE / "theme.name").exists() else ""
        src = STATE / "theme/colors.toml"
    if not src.exists() or not LAYOUT.exists():
        return  # nothing to read or nothing to paint: leave the layout alone
    look = PINS.get(name) or derive(tomllib.loads(src.read_text()))

    text = LAYOUT.read_text()
    root = json.loads(text)
    root["theme"] = "omarchy"
    if look["colors"]:
        root["colors"] = look["colors"]
    else:
        root.pop("colors", None)
    if (n := find(root, "dim")):
        n["background"] = look["dim"]
    for id_ in ISLANDS:
        if (n := find(root, id_)):
            n["background"] = look["island"]
    if (n := find(root, "main")) and isinstance(n.get("content", {}).get("pane"), dict):
        n["content"]["pane"]["background"] = look["pane"]

    out = json.dumps(root, indent=2, ensure_ascii=False) + "\n"
    if out != text:
        tmp = LAYOUT.with_suffix(".json.tmp")
        tmp.write_text(out)
        tmp.replace(LAYOUT)
    print(f"glass-islands <- {name or '?'}{' (pinned)' if name in PINS else ''}: "
          f"islands {look['island']}, panes {look['pane']}, veil {look['dim']}")


if __name__ == "__main__":
    main()
