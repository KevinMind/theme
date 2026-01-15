if [[ -z "$GIT_NAME" || -z "$GIT_EMAIL" ]]; then
    log_warning "GIT_NAME and GIT_EMAIL variables are required"
    log_info "Skipping git configuration"
    exit 0
fi

if not_dry "Configuring Git with name: $GIT_NAME and email: $GIT_EMAIL..."; then
    git config --global user.name "$GIT_NAME" || {
        log_error "Failed to set git user.name"
        exit 1
    }

    git config --global user.email "$GIT_EMAIL" || {
        log_error "Failed to set git user.email"
        exit 1
    }

    git config --global core.editor "cursor -w"
    git config --global http.postBuffer 524288000

    # Remove low speed settings if they exist
    git config --global --unset http.lowSpeedLimit 2>/dev/null || true
    git config --global --unset http.lowSpeedTime 2>/dev/null || true

    log_success "Git configured with name: $GIT_NAME and email: $GIT_EMAIL"
fi
