#####################################
##==> Variables
#####################################
function shenv
    set -gx $argv
end
source ~/.env

# SSH Agent - fixed socket via systemd user service
set -gx SSH_AUTH_SOCK /run/user/1000/ssh-agent.socket

# Add key if not already added (only in interactive sessions)
if status is-interactive
    ssh-add -l &>/dev/null; or ssh-add ~/.ssh/id_ed25519
end

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
if command -q zoxide
    zoxide init fish --cmd cd | source
end

if command -q atuin
    atuin init fish --disable-up-arrow | source
end

if command -q starship
    starship init fish | source
end

# FZF Theme
if command -q fzf
    fzf --fish | FZF_CTRL_R_COMMAND= source

    set -Ux FZF_DEFAULT_OPTS "\
            --color=bg+:#313244,bg:#1E1E2E,spinner:#F5E0DC,hl:#F38BA8 \
            --color=fg:#CDD6F4,header:#F38BA8,info:#CBA6F7,pointer:#F5E0DC \
            --color=marker:#B4BEFE,fg+:#CDD6F4,prompt:#CBA6F7,hl+:#F38BA8 \
            --color=selected-bg:#45475A \
            --color=border:#313244,label:#CDD6F4"
    set -g FZF_CTRL_T_COMMAND "command find -L \$dir -type f 2> /dev/null | sed '1d; s#^\./##'"
end

set fish_greeting

#####################################
##==> Fun Stuff
#####################################
