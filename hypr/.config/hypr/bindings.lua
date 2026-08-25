-- Keep only your personal keybinding overrides here. Add new bindings or
-- unbind defaults before replacing them.

-- See current bindings and descriptions:
--   omarchy menu keybindings --print

-- To disable every Omarchy default binding, set this in
-- ~/.config/hypr/hyprland.lua before require("default.hypr.omarchy"), then add
-- only the bindings you want below:
--   omarchy_default_bindings = false

-- To disable all preinstalled app/webapp bindings, set:
--   omarchy_preinstalled_bindings = false

-- Add a new binding.
-- o.bind("SUPER + SHIFT + R", "SSH", "alacritty -e ssh your-server")

-- Change an existing binding by unbinding it first, then binding the key again.
-- This example changes SUPER+SPACE from the launcher to the Omarchy root menu.
-- hl.unbind("SUPER + SPACE")
-- o.bind("SUPER + SPACE", "Omarchy menu", "omarchy-menu toggle root")

-- Disable a default binding without replacing it.
-- hl.unbind("SUPER + SHIFT + B")

-- Logitech MX Keys examples:
-- o.bind("SUPER + SHIFT + S", nil, "omarchy-capture-screenshot")
-- o.bind("SUPER + H", nil, "voxtype record toggle")
-- o.bind("SUPER + PERIOD", nil, "omarchy-shell shell toggle omarchy.emojis")

-- Scale da tela
hl.unbind("SUPER + SLASH")
hl.unbind("SUPER + ALT + SLASH")

-- Browser
hl.unbind("SUPER + SHIFT + RETURN")

-- Calendar (Hey)
hl.unbind("SUPER + SHIFT + C")

-- Email (Hey)
hl.unbind("SUPER + SHIFT + E")

-- Novo Email (Hey)
hl.unbind("SUPER + SHIFT + ALT + E")

-- X
hl.unbind("SUPER + SHIFT + X")

-- Novo Post no X
hl.unbind("SUPER + SHIFT + ALT + X")

-- Grok
hl.unbind("SUPER + SHIFT + ALT + A")

-- Theme Menu
hl.unbind("SUPER + SHIFT + CTRL + SPACE")

-- Background Switcher
hl.unbind("SUPER + CTRL + SPACE")

-- Switch de workspaces sem precisar de número
hl.unbind("SUPER + SHIFT + TAB")
hl.unbind("SUPER + CTRL + TAB")
hl.unbind("SUPER + TAB")

-- Menu de APPs (inútil, agora tem fuzzy search no menu principal)
hl.unbind("SUPER + ALT + SPACE")

-- Calendário no shell
hl.unbind("SUPER + CTRL + ALT + D")

-- Mostra a hora
hl.unbind("SUPER + CTRL + ALT + T")

-- 1password
hl.unbind("SUPER + SHIFT + SLASH")

-- Spotify
hl.unbind("SUPER + SHIFT + M")

-- Signal
hl.unbind("SUPER + SHIFT + G")

-- Google Messages
hl.unbind("SUPER + SHIFT + CTRL + G")

-- ============================ BINDS
-- KeepassXC
o.bind("SUPER + SHIFT + SLASH", "Passwords", "keepassxc")

-- Calendário no shell
o.bind("SUPER + CTRL + ALT + C", "Calendar", "omarchy-shell shell toggle omarchy.clock")

-- Code
o.bind("SUPER + SHIFT + C", "VS Code", "code")

-- Claude
o.bind("SUPER + SHIFT + ALT + A", "Claude", { webapp = "https://claude.ai" })

-- YT Music
o.bind("SUPER + SHIFT + M", "Music", { webapp = "https://music.youtube.com/", focus = true })

-- Lazygit
o.bind("SUPER + SHIFT + G", "Lazygit", "lazygit")
