#!/usr/bin/env bash
# Configuração pessoal do Herdr (layout glass-islands, mods, pets, atalhos).
#
# O Herdr NÃO é instalado com stow: ele carrega arquivos via symlink, mas o hot reload
# para de funcionar e ele mesmo regrava alguns arquivos (settings.json), trocando o
# symlink por um arquivo comum. Por isso os arquivos ficam copiados em herdr/ (mesma
# estrutura do stow) e este script copia nos dois sentidos.
#
#   ./herdr.sh save      ~/.config/herdr-app -> dotfiles (depois é só commitar)
#   ./herdr.sh install   dotfiles -> ~/.config/herdr-app (máquina nova / restaurar)
#   ./herdr.sh diff      mostra o que difere entre os dois
#
# Só os arquivos listados em ITEMS são tocados. Os mods e layouts que vêm com o Herdr,
# o estado dele (view.json, shared.json, ...) e os arquivos gerados (AGENTS.md, *.d.ts,
# jsconfig.json) ficam de fora.

set -euo pipefail

LIVE="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/herdr/.config/herdr-app"

ITEMS=(
  keys.json
  settings.json
  layouts/glass-islands.json
  layouts/glass-islands.png
  themes/rose-pine.json
  themes/omarchy.json
  backgrounds/bapet-sky.jpg
  tools/bake-pet.py
  tools/omarchy-colors.py
  licenses/
  mods/sleek-chrome/
  mods/sleek-workspaces/
  mods/sleek-tabs/
  mods/sleek-pane/
  mods/sleek-status/
  mods/sleek-files/
  mods/my-goto/
  mods/my-prompt/
  mods/herdsidian/
  mods/better-changes/
)
EXCLUDES=(--exclude jsconfig.json --exclude 'gpui-kit.d.ts' --exclude '*.error')

copy() { # from to
  local from=$1 to=$2 item
  for item in "${ITEMS[@]}"; do
    if [[ ! -e "$from/$item" ]]; then
      echo "  faltando: $item" >&2
      continue
    fi
    mkdir -p "$(dirname "$to/$item")"
    if [[ $item == */ ]]; then
      rsync -a --delete "${EXCLUDES[@]}" "$from/$item" "$to/$item"
    else
      rsync -a "$from/$item" "$to/$item"
    fi
  done
}

case "${1:-}" in
  save)
    copy "$LIVE" "$REPO"
    echo "Salvo em $REPO"
    git -C "$REPO" status --short -- . | head -40
    ;;
  install)
    [[ -d "$LIVE" ]] || { echo "Abra o Herdr uma vez antes (ele cria $LIVE)." >&2; exit 1; }
    # Guarda o que seria sobrescrito, caso algo local não tenha sido salvo.
    backup="$LIVE.bak-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup"
    for item in "${ITEMS[@]}"; do
      [[ -e "$LIVE/$item" ]] || continue
      mkdir -p "$(dirname "$backup/$item")"
      cp -a "$LIVE/${item%/}" "$backup/${item%/}"
    done
    copy "$REPO" "$LIVE"
    # As cores do layout acompanham o tema do Omarchy (hook theme-set.d/30-herdr-glass, no
    # pacote omarchy). Pinta já com o tema atual, em vez das cores de quando foi salvo.
    python3 "$LIVE/tools/omarchy-colors.py" || true
    echo "Instalado em $LIVE (backup do anterior: $backup)"
    echo "No Herdr: ctrl-shift-l até o layout 'glass-islands', ou: herdr-app do layout.switch --name glass-islands"
    ;;
  diff)
    for item in "${ITEMS[@]}"; do
      diff -rq "${EXCLUDES[@]/--exclude/-x}" "$LIVE/${item%/}" "$REPO/${item%/}" 2>&1 || true
    done | grep -v '^$' || echo "Sem diferenças."
    ;;
  *)
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
