#####################################
##==> Environment Variables
#####################################
function shenv
    set -gx $argv
end
source ~/.env

fish_add_path ~/.local/bin
fish_add_path ~/bin

if test -S /run/user/1000/ssh-agent.socket
    # SSH Agent - fixed socket via systemd user service
    set -gx SSH_AUTH_SOCK /run/user/1000/ssh-agent.socket

    if status is-interactive
        ssh-add -l &>/dev/null; or ssh-add ~/.ssh/id_ed25519
    end
end
