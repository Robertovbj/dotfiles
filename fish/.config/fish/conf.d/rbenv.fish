if test -d $HOME/.rbenv/bin
    fish_add_path $HOME/.rbenv/bin

    # Só inicializa se o comando existir
    if type -q rbenv
        rbenv init - | source
    end
end
