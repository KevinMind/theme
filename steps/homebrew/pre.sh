# Check if Homebrew is installed
if command_exists "brew"; then
    log_success "Homebrew already installed"
    exit 0
fi

if not_dry "Installing Homebrew..."; then
    bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
        log_error "Failed to install Homebrew"
        exit 1
    }

    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ $(uname -m) == 'arm64' ]]; then
        if not_dry "Adding Homebrew to PATH for Apple Silicon..."; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi

    log_success "Homebrew installed successfully"
fi
