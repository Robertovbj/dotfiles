#!/usr/bin/env bash

omarchy theme set Catppuccin

omarchy update

omarchy install browser firefox

omarchy default browser firefox 

omarchy install editor vscode

omarchy default editor nvim

omarchy install terminal kitty

omarchy default terminal kitty 

# Install common packages.
#
# atuin            - Shell history with sync and search
# fish             - Fish shell
# lshw             - System hardware information
# less             - Terminal pager
# keepassxc        - Password manager
# lazydocker       - Docker TUI
# lazygit          - Git TUI
# noto-fonts-cjk   - Japanese, Chinese, and Korean fonts
# openssh          - SSH client
# ripgrep          - Fast text search
# screen           - Terminal multiplexer/background sessions
# starship         - Cross-shell prompt
# stow             - Dotfile manager
# zoxide           - Smarter directory navigation
# net-tools        - Legacy networking tools (netstat, route, arp)
# nmap             - Network scanner
# wine             - Run Windows applications
# fzf              - Fuzzy finder
# fd               - Fast file finder

yay -Sy \
  atuin \
  fish \
  lshw \
  less \
  keepassxc \
  lazydocker \
  lazygit \
  noto-fonts-cjk \
  openssh \
  ripgrep \
  screen \
  starship \
  stow \
  zoxide \
  net-tools \
  nmap \
  wine \
  fzf \
  fd

omarchy install gaming steam