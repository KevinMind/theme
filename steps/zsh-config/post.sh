ZSHRC="${HOME}/.zshrc"

# Ensure .zshrc exists
if [[ ! -f "${ZSHRC}" ]]; then
    if not_dry "Creating ${ZSHRC}..."; then
        touch "${ZSHRC}"
        log_success "Created ${ZSHRC}"
    fi
fi

# Add Google Cloud SDK to PATH
GCLOUD_SDK_BIN="/opt/homebrew/share/google-cloud-sdk/bin"
GCLOUD_PATH_STRING="export PATH=${GCLOUD_SDK_BIN}:\"\$PATH\""

if [[ -f "${ZSHRC}" ]] && grep -Fxq "$GCLOUD_PATH_STRING" "${ZSHRC}"; then
    log_success "Google Cloud SDK path already in ZSHRC"
elif not_dry "Adding Google Cloud SDK path to ZSHRC..."; then
    echo "" >> "${ZSHRC}"
    echo "# Add Google Cloud SDK to PATH" >> "${ZSHRC}"
    echo "$GCLOUD_PATH_STRING" >> "${ZSHRC}"
    log_success "Google Cloud SDK path added to ZSHRC"
fi

# Add Ghostty shell integration
GHOSTTY_ZSH_STRING='# Ghostty shell integration
function set_ghostty_title {
  print -Pn "\e]0;%n@%m: %~ \a"
  print -Pn "\e]7;file://$(hostname)$(pwd)\a"
}
precmd_functions+=(set_ghostty_title)'

if [[ -f "${ZSHRC}" ]] && grep -q "set_ghostty_title" "${ZSHRC}"; then
    log_success "Ghostty ZSH integration already present"
elif not_dry "Adding Ghostty ZSH integration..."; then
    echo "" >> "${ZSHRC}"
    echo "$GHOSTTY_ZSH_STRING" >> "${ZSHRC}"
    log_success "Ghostty ZSH integration added"
fi
