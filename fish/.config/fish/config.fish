#####################################
##==> Variables
#####################################
function shenv; set -gx $argv; end
source ~/.env

#####################################
##==> Aliases
#####################################
alias cls="clear"
alias g="git"
alias n="nvim"
alias m="micro"
alias t="task"
alias cd="z"

# Docker
alias docp='docker compose'
alias docpd='docker compose down'
alias dops='docker ps'
alias docpub='docker compose up -d --build'
alias doexecit='docker exec -it'
alias doexec='docker exec'

# Github
alias ghcs='gh copilot suggest'
alias ghce='gh copilot explain'


#####################################
##==> Custom Functions
#####################################
function wget
    command wget --hsts-file="$XDG_DATA_HOME/wget-hsts" $argv
end

function nvidia-settings
    mkdir -p $XDG_CONFIG_HOME/nvidia/
    command nvidia-settings --config="$XDG_CONFIG_HOME/nvidia/settings" $argv
end

#####################################
##==> Interactive Session Settings
#####################################
if status is-interactive
    [ "$TERM" = xterm-kitty ] && alias ssh="kitty +kitten ssh"
end

#####################################
##==> Shell Customization
#####################################
starship init fish | source
fzf --fish | FZF_CTRL_R_COMMAND= source
atuin init fish --disable-up-arrow | source
zoxide init fish | source
#oh-my-posh init fish --config https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/refs/heads/main/themes/catppuccin.omp.json | source
set fish_greeting

#####################################
##==> Development Tools
#####################################
##==> Pyenv
pyenv init - | source

#TODO: Fazer verificação de instalação do flutter e ruby antes
# Flutter
#set -Ua fish_user_paths $HOME/.flutter/flutter/bin
#set -Ux ANDROID_SDK_ROOT /opt/android-sdk
#set -Ua fish_user_paths $ANDROID_SDK_ROOT/cmdline-tools/latest/bin
#set -Ua fish_user_paths $ANDROID_SDK_ROOT/platform-tools
#set -Ua fish_user_paths $ANDROID_SDK_ROOT/emulator

# Ruby
#set -x PATH $HOME/.rbenv/bin $PATH
#status --is-interactive; and source (rbenv init -|psub)

#####################################
##==> Fun Stuff
#####################################
