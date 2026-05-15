if test -d ~/.local/share/gem/ruby/3.4.0
    set -x GEM_HOME ~/.local/share/gem/ruby/3.4.0
    set -x GEM_PATH ~/.local/share/gem/ruby/3.4.0 /usr/lib/ruby/gems/3.4.0
    fish_add_path ~/.local/share/gem/ruby/3.4.0/bin
end
