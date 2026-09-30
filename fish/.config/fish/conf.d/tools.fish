#####################################
##==> Shell Tools Initialization
#####################################
if status is-interactive
    if command -q zoxide
        zoxide init fish --cmd cd | source
    end

    if command -q atuin
        atuin init fish --disable-up-arrow | source
    end

    if command -q starship
        starship init fish | source
    end

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

    if command -q try
        # ~/.local/try.rb init | source
        # try init ~/src/tries | source
        SHELL=(command -s fish) try init ~/Work/tries | source
    end
end
