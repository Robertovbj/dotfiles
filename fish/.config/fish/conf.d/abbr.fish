#####################################
##==> Aliases/Abbreviations
#####################################
abbr -a cls clear
abbr -a n nvim
abbr -a m micro
abbr -a t task
abbr -a L --position anywhere --set-cursor "% | less"

# Directories
abbr -a .. 'cd ..'
abbr -a ... 'cd ../..'
abbr -a .... 'cd ../../..'

# Docker
abbr -a docp 'docker compose'
abbr -a docpd 'docker compose down'
abbr -a dops 'docker ps'
abbr -a docpub 'docker compose up -d --build'
abbr -a doexecit 'docker exec -it'
abbr -a doexec 'docker exec -it'

# File system
if command -q eza
    alias ls "eza -lh --group-directories-first --icons=auto"
    alias lsa "ls -a"
    alias lt "eza --tree --level=2 --long --icons --git"
    alias lta "lt -a"
end

# Git
abbr -a g git
abbr -a gcm 'git commit -m'
abbr -a gcam 'git commit -a -m'
abbr -a gcad 'git commit -a --amend'

# Github
abbr -a ghcs 'gh copilot suggest'
abbr -a ghce 'gh copilot explain'

# Tools
abbr -a c copilot

# Kitty
if status is-interactive
    [ "$TERM" = xterm-kitty ] && alias ssh="kitty +kitten ssh"
end
