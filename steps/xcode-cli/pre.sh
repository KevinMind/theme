# Check if already installed
if xcode-select -p &>/dev/null; then
    log_success "Xcode Command Line Tools already installed at $(xcode-select -p)"
    exit 0
fi

if not_dry "Installing Xcode Command Line Tools..."; then
    # Try to install - this may show a dialog or say already installed
    install_output=$(xcode-select --install 2>&1)

    # Check if already installed (different state)
    if echo "$install_output" | grep -q "already installed"; then
        log_success "Xcode Command Line Tools already installed"
        log_info "To check for updates, run: softwareupdate --list"
        exit 0
    fi

    # Installation dialog was triggered
    echo ""
    log_warning "A dialog should have appeared to install Xcode Command Line Tools"
    log_info "Once installation completes, press Enter to continue..."
    log_info ""
    log_info "If no dialog appeared, you can install manually:"
    log_info "  1. Open System Settings → General → Software Update"
    log_info "  2. Or run: softwareupdate --install --all"
    echo ""
    read -r < /dev/tty

    if xcode-select -p &>/dev/null; then
        log_success "Xcode Command Line Tools installed"
    else
        log_error "Xcode Command Line Tools installation failed or incomplete"
        log_info "Try running manually: xcode-select --install"
        exit 1
    fi
fi
