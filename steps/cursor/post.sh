# Install Kevinmind theme extension
if not_dry "Installing Kevinmind theme extension..."; then
    VSIX_URL=$(curl -s https://api.github.com/repos/KevinMind/theme/releases/latest | grep -o 'https://.*\.vsix' | head -1)

    if [[ -n "$VSIX_URL" ]]; then
        curl -L "$VSIX_URL" -o /tmp/kevinmind.vsix && \
        cursor --install-extension /tmp/kevinmind.vsix && \
        rm /tmp/kevinmind.vsix && \
        log_success "Kevinmind theme installed successfully" || {
            log_warning "Failed to install Kevinmind theme"
        }
    else
        log_warning "Could not find Kevinmind theme release"
    fi
fi
