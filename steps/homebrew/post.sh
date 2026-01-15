# Install packages from Brewfile
BREW_FILE="${HOME}/.Brewfile"

if [[ ! -f "$BREW_FILE" ]]; then
    log_error "Brewfile not found at $BREW_FILE"
    exit 1
fi

if not_dry "Installing Homebrew packages from ${BREW_FILE}..."; then
    brew bundle install --file="${BREW_FILE}" || {
        log_warning "Some Homebrew packages failed to install"
    }
    log_success "Homebrew packages installed"
fi
