1. Instalar yay (Caso necessário)
    ```bash
    sudo pacman -S --needed git base-devel
    git clone https://aur.archlinux.org/yay.git
    cd yay
    makepkg -si
    ```

2. Instalar pacotes
    ```bash
    yay -Syu \
        atuin \  # Histórico terminal
        base-devel \
        cargo \
        deskflow \
        docker docker-compose docker-buildx \  # Containers
        eza \
        fd \
        fish \
        flatpak \
        fzf \  # Busca fuzzy
        gparted \
        go \
        inetutils \
        keepassxc \  # Gerenciador de senha
        lazydocker \  # Gerenciador docker
        lazygit \  # Gerenciador git
        less \  # Conseguir fazer scroll no terminal
        lshw \  # Informações do sistema
        meson \
        microsoft-edge-stable-bin \  # Edge
        neovim \  # nvim
        net-tools \
        nmap \
        npm \
        noto-fonts-cjk \
        openssh \
        openssh-server \
        ripgrep \
        screen \
        starship \  # Customização de terminal
        stow \  # Para dotfiles
        task taskwarrior-tui \  # Tarefas
        tree-sitter-cli \
        visual-studio-code-bin \
        wine \
        zoxide \
        fcitx5 fcitx5-qt fcitx5-gtk fcitx5-configtool \
        rofi rofiemoji  # Emojis 
    #   pidgin pidgin-indicator pidgin-libnotify \  # Pidgin
    #   cups system-config-printer ghostscript \  # Impressora
    ```

3. Fazer o stow (`stow -t /home/$USER`) dos seguintes :
    - atuin
    - fish
    - hyprland
    - kitty
    - starship
    - waybar

4. Alterar o swap
    ```bash
    echo "[zram0]" sudo >/etc/systemd/zram-generator.conf
    echo "zram-size = ram * 4" sudo >>/etc/systemd/zram-generator.conf
    echo "compression-algorithm = zstd" sudo >>/etc/systemd/zram-generator.conf
    ```

5. [Opcional] (Corrigir cedilha)[https://www.reddit.com/r/archlinux/comments/1fceq7p/cedilla_not_working_as_intended/]
