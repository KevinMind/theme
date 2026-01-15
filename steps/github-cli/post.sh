if ! command_exists gh; then
    log_error "gh not found in PATH"
    log_info "Try: brew install gh"
    exit 1
fi

# Check if already authenticated
if gh auth status &>/dev/null; then
    log_success "GitHub CLI already authorized"
    exit 0
fi

# Try token auth if provided
if [[ -n "$GITHUB_TOKEN" ]]; then
    if not_dry "Authenticating GitHub CLI with provided token..."; then
        if echo "$GITHUB_TOKEN" | gh auth login --with-token; then
            log_success "GitHub CLI authorized"
        else
            log_error "GitHub CLI token authentication failed"
            exit 1
        fi
    fi
else
    # Interactive auth with device code flow
    if not_dry "Starting GitHub CLI authentication..."; then
        log_info "Follow the prompts below to authenticate:"
        echo ""
        if gh auth login --hostname github.com --git-protocol https --web; then
            log_success "GitHub CLI authorized"
        else
            log_error "GitHub CLI authentication failed"
            log_info "Try running manually: gh auth login"
            exit 1
        fi
    fi
fi
