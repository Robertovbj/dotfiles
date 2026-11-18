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
        lshw \  # Informaçoes do sistema
        lvsk-calendar \  # Calendário TUI
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
        ruby ruby-bundler \  # Ruby e Bundler (necessário para o Ruby LSP)
        screen \
        starship \  # Customização de terminal
        stow \  # Para dotfiles
        tree-sitter-cli \
        visual-studio-code-bin \
        wine \
        zoxide \
        fcitx5 fcitx5-qt fcitx5-gtk fcitx5-configtool
    #   pidgin pidgin-indicator pidgin-libnotify \  # Pidgin
    #   cups system-config-printer ghostscript \  # Impressora
    ```

3. Fazer o stow dos pacotes
    ```bash
    cd ~/dotfiles
    stow -t ~ atuin environment fish git hypr kitty nvim omarchy starship
    ```
    - atuin: config e temas do histórico
    - environment: variáveis do `~/.config/environment.d` (Ruby, Firefox no Wayland, Superwhisper)
    - fish: config, abreviações, funções e completions
    - git: `.gitconfig`
    - hypr: Hyprland (atalhos, monitores, aparência, regras do BApet quando ele está instalado)
    - kitty: config e sessões
    - nvim: LazyVim. O `lua/plugins/theme.lua` é criado pelo Omarchy e fica fora do dotfiles
    - omarchy: barra (`shell.json`), menu, hooks de troca de tema, templates e temas próprios (Columbina)
    - starship: prompt

    Numa instalação nova do Omarchy, alguns desses arquivos já existem e o stow recusa. Para ficar com os do dotfiles:
    ```bash
    stow --adopt -t ~ <pacote>   # move o arquivo existente para o dotfiles e cria o link
    git checkout -- .            # volta o dotfiles para a versão commitada
    ```

    O Omarchy regrava o `shell.json` quando a barra muda (`omarchy bar`, menu), e o link vira arquivo comum. Para trazer a mudança de volta:
    ```bash
    stow --adopt -t ~ omarchy    # depois é só commitar
    ```

4. Mudar o shell para fish com `chsh -s /usr/bin/fish` e para o sudo `sudo chsh -s /bin/fish`

5. Alterar o swap
    ```bash
    echo "[zram0]" sudo >/etc/systemd/zram-generator.conf
    echo "zram-size = ram * 4" sudo >>/etc/systemd/zram-generator.conf
    echo "compression-algorithm = zstd" sudo >>/etc/systemd/zram-generator.conf
    ```

6. [Opcional] (Corrigir cedilha)[https://www.reddit.com/r/archlinux/comments/1fceq7p/cedilla_not_working_as_intended/]

7. Herdr (layout `glass-islands`, mods, pets e atalhos) — **não usa stow**
    ```bash
    ./herdr.sh install   # dotfiles -> ~/.config/herdr-app (abra o Herdr uma vez antes)
    ./herdr.sh save      # ~/.config/herdr-app -> dotfiles, depois de mudar algo no Herdr
    ./herdr.sh diff      # o que mudou entre os dois
    ```
    O Herdr não recarrega arquivos via symlink e regrava alguns sozinho, por isso fica copiado.
    Os pets usam os modelos do BApet: para criar novos, veja
    `herdr/.config/herdr-app/mods/sleek-workspaces/pets/AGENTS.md`.
