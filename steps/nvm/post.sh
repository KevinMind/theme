# Check if NVM is already installed
if [[ -s "$HOME/.nvm/nvm.sh" ]] && command -v nvm &>/dev/null; then
    log_success "NVM already installed"
    exit 0
elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    log_success "NVM already installed (sourcing)"
    source "$HOME/.nvm/nvm.sh"
    exit 0
fi

if not_dry "Installing NVM..."; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash || {
        log_error "Failed to install NVM"
        exit 1
    }
    log_success "NVM installed successfully"
fi

# Add NVM to .zshrc
ZSHRC="${HOME}/.zshrc"
NVM_SOURCE_STRING='export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion'

if [[ -f "${ZSHRC}" ]] && grep -q "NVM_DIR" "${ZSHRC}"; then
    log_success "NVM source line already present in ZSHRC"
elif not_dry "Adding NVM source line to ZSHRC..."; then
    echo "" >> "${ZSHRC}"
    echo "$NVM_SOURCE_STRING" >> "${ZSHRC}"
    log_success "NVM source line added to ZSHRC"
fi
