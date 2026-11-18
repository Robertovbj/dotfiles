-- Learn how to configure Hyprland: https://wiki.hypr.land/Configuring/Start/

-- Omarchy's bootstrap keeps path setup out of this user config.
dofile((os.getenv("OMARCHY_PATH") or "/usr/share/omarchy") .. "/default/hypr/bootstrap.lua")

-- Disable all Omarchy default bindings. Add your own in hypr/bindings.lua.
-- omarchy_default_bindings = false
--
-- Or disable only bindings for Omarchy's preinstalled apps/web apps while
-- keeping core window-manager bindings:
-- omarchy_preinstalled_bindings = false

-- Load Omarchy defaults.
-- Your own gestures replace Omarchy's defaults.
omarchy_default_gestures = false

require("default.hypr.omarchy")

-- Put your personal overrides in these files. They're loaded after Omarchy's
-- defaults so package updates can improve the defaults without rewriting your
-- ~/.config/hypr files.
require("hypr.monitors")
require("hypr.input")
require("hypr.bindings")
require("hypr.looknfeel")
require("hypr.autostart")

-- Toggle config flags dynamically.
require("default.hypr.toggles")

-- Add any other personal Hyprland configuration below.
-- o.window("qemu", { workspace = "5" })

-- BApet: regras das janelas dos pets. Só carrega se o BApet estiver instalado,
-- para o config não quebrar numa máquina sem ele.
local function bapet_instalado()
  local dirs = { (os.getenv("HOME") or "") .. "/.local/bin" }
  for dir in (os.getenv("PATH") or ""):gmatch("[^:]+") do dirs[#dirs + 1] = dir end
  for _, dir in ipairs(dirs) do
    local f = io.open(dir .. "/bapet-ghost", "r")
    if f then f:close() return true end
  end
  return false
end

if bapet_instalado() then
  pcall(require, "hypr.bapet")
end
