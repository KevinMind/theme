if ! command_exists gt; then
    log_warning "Graphite CLI not found"
    log_info "Install with: brew install withgraphite/tap/graphite"
    exit 0
fi

# Check if already authenticated
if gt auth --cwd "${HOME}" &>/dev/null; then
    log_success "Graphite CLI already authenticated"
    exit 0
fi

if [[ -z "$GRAPHITE_TOKEN" ]]; then
    log_warning "GRAPHITE_TOKEN not provided"
    log_info "Get your token from: https://app.graphite.com/activate"
    log_info "Then run: gt auth --token <your-token>"
    exit 0
fi

# Parse token from full command if user pasted "gt auth --token <token>"
if [[ "$GRAPHITE_TOKEN" == *"--token"* ]]; then
    GRAPHITE_TOKEN=$(echo "$GRAPHITE_TOKEN" | grep -oE '\-\-token[[:space:]]+[^[:space:]]+' | awk '{print $2}')
fi

if not_dry "Authenticating Graphite CLI..."; then
    if gt auth --token "$GRAPHITE_TOKEN" --cwd "${HOME}"; then
        log_success "Graphite CLI configured"
    else
        log_error "Graphite CLI authentication failed"
        log_info "Your token may be invalid or expired"
        log_info "Get a new token from: https://app.graphite.com/activate"
        exit 1
    fi
fi
