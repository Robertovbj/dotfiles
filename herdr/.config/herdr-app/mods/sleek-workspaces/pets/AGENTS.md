# Pets: Blue Archive characters on the agent cards

Each agent card in the `glass-islands` sidebar (`mods/sleek-workspaces`) shows a Blue Archive
character whose animation follows the agent's status. The characters are the 3D models of the
person's BApet desktop pets, rendered **offline, once** into PNG frames by
`~/.config/herdr-app/tools/bake-pet.py`. Herdr never renders 3D; it only shows these files.

When asked to add, change or remove a pet, do it yourself with the steps below. Don't ask the
person to run anything.

## Layout of this folder

```
pets/
  AGENTS.md                 this file
  <Name>/                   one per character, named like its model (Mika, Kei, ...)
    bake.json               per-character settings (edit, then bake again)
    still.png               idle, asleep: a single still frame (first frame of the idle loop)
    frames/working/NNN.png  working loop: attack start -> <mag> shots -> reload -> again
    frames/blocked/NNN.png  blocked loop (panic)
    frames/done/NNN.png     done loop (victory)
    frames/idle/NNN.png     idle loop (played for a while, see below)
    meta.json               frame size and frame counts (read by the sidebar; written by the bake)
../pets.json                which characters are used (pool, byApp) and the card size
```

## How the sidebar uses them

- `pets.json` → `pool`: every agent gets one character from the pool, picked by a hash of its
  terminal address, so it keeps the same one. `byApp` overrides by agent kind
  (`{"claude-code": "Mika", "codex": "Kei"}`; keys are the agent's `app`, program key or lower-cased
  program name). `size` is the card's sprite box in px (currently 100).
- working / blocked → their loops, swapped by the mod 8 times a second.
- When an agent stops (working/blocked → done or idle) it plays the victory **once**, then the
  idle loop for 30 s (`IDLE_ANIM_MS`), then the still frame, whether the status says done or idle.
  Herdr often skips `done` (an agent you're looking at goes straight to idle), so this is what
  shows that it finished. A busy spell under 3 s (`PET_MIN_BUSY_MS`) is a flicker and doesn't
  replay the victory. done → idle gives another 30 s of idle loop.
- Hovering a pet plays its idle loop for 15 s (`HOVER_ANIM_MS`).
- Otherwise idle → `still.png`, with no redraws. Frames are only swapped while some shown pet
  is animating.
- The sprite fills the box height at the frame's real aspect (`meta.json` width/height), centered;
  wide weapons can run past the box edges (Kei's railgun does).
- `meta.json` is read only for names in `pool` / `byApp`, when the mod starts. Saving `pets.json`
  (or any file in `mods/sleek-workspaces`) reloads it.

**Don't switch to animated WebP/GIF.** It's simpler but Herdr then redraws the whole window
nonstop while one is visible (measured: ~18% of a core vs ~9% with frame swapping, 5.5% baseline).
For the same reason the cards have no `.loop()` / pulsing decorations: keep it that way.

## Add a character

1. **Model.** Models are BApet's downloads: `~/.local/share/bluearchive-desktop-pet/models/<Name>.glb`
   (exact file name, case included; skins look like `Mika (Swimsuit).glb`).
   If it isn't there, BApet downloads it when the pet is added:
   `BlueArchiveDesktopPet --add "<Name>"` (this also puts the pet on the desktop; tell the person,
   they can remove it from BApet's menu). Wait until the `.glb` exists.
2. **Magazine.** The person gives it ("Hina 30 mag"). Add it to `MAGS` in `tools/bake-pet.py`
   (used to create `bake.json` the first time). If unknown, ask; don't guess silently.
3. **Bake** (takes 10–60 s; longer magazines make longer loops):
   ```sh
   cd /tmp && QT_QPA_PLATFORM=offscreen ~/.local/share/bapet/venv/bin/python -I \
     ~/.config/herdr-app/tools/bake-pet.py "<Name>"
   ```
   It prints the clips it chose, e.g.
   `working -> Normal_Attack_Start@90° > Normal_Attack_Ing@90° ×mag > Normal_Reload@45°`.
   A line `<part>: none of [...] found, using ...` means the model names its clips differently:
   run the same command with `--list`, pick the right names, put them in `<Name>/bake.json` →
   `anims`, bake again.
4. **Look at it.** Make a contact sheet and view it (Read the PNG):
   ```sh
   P=~/.config/herdr-app/mods/sleek-workspaces/pets/<Name>
   magick montage $P/still.png $P/frames/working/006.png $P/frames/working/020.png \
     $P/frames/blocked/004.png $P/frames/done/010.png -tile 5x -geometry 130x110+2+2 \
     -background '#333344' /tmp/<scratch>/sheet.png
   ```
   Check: the weapon points to the **right** while shooting, the reload is turned partway back,
   nothing is cut off at the top or bottom.
5. **Use it.** Add the name to `pool` in `mods/sleek-workspaces/pets.json` (or to `byApp`).
6. **Verify:** `herdr-app check ~/.config/herdr-app/mods/sleek-workspaces` passes,
   `herdr-app status` shows no errors, and a `herdr-app shot` shows the card.
7. **Save to the dotfiles:** `~/dotfiles/herdr.sh save` (copies the Herdr config, pets included,
   into `~/dotfiles/herdr/`). Don't commit unless the person asks.

## bake.json

```json
{ "mag": 5, "aim_yaw": 90, "reload_yaw": 45,
  "anims": { "start": ["Normal_Attack_Start"], "shot": ["Normal_Attack_Ing"], "reload": ["Normal_Reload"],
             "blocked": ["Vital_Panic", ...], "done": ["Victory_Start", ...], "idle": ["Cafe_Idle", ...] } }
```

- `mag`: shots per magazine. One `shot` clip = one shot (true for these models; if a character
  fires a burst per clip, say so to the person and lower `mag`).
- `aim_yaw`: degrees turned while shooting; **+90 = facing right** (−90 faces left, 0 faces the
  viewer). `reload_yaw`: degrees while reloading (45 = halfway back toward the viewer).
- `anims`: clip names per part; the first one the model has wins.
- After editing, bake again. The bake replaces that character's `frames/`, `still.png` and `meta.json`.

Fixed in the script (same for everyone): 8 fps, 240 px tall renders, outline 0.1 px (as the
person's BApet wrapper), camera pitch from `~/.config/bluearchive-desktop-pet/settings.json`,
0.15 s pose blends and 0.35 s turns between clips, blocked/done/idle clips cut at 6 s.

## Remove a character

Take it out of `pool` / `byApp` first, then delete `pets/<Name>/`. Agents that had it get another
from the pool.

## Current characters

| Name | mag |
|---|---|
| Mika | 5 |
| Kei | 5 |
| Rena | 5 |
| Hikari | 6 |
| Hifumi | 5 |
| Momiji | 1 |
| Chise | 6 |
| Yuuka | 9 |
| Mutsuki | 15 |

Keep this table in sync when adding or removing one.
