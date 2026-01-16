#!/bin/bash

################################################################################
# Booti Bootstrap Script
#
# This script sets up a complete macOS development environment from scratch.
# It installs tools, configures settings, and sets up for development.
#
# Usage: ./booti.sh [options]
#
# Options:
#   --dry-run             Run in dry-run mode, no changes will be made.
#   --no-input            Run in non-interactive mode, using defaults or arguments.
#   --git-name "Name"     Set the git user name.
#   --git-email "Email"    Set the git user email.
#   --github-token "Token" Set the GitHub auth token.
#
# Prerequisites: macOS
################################################################################

set -ue

# Configuration
SELF_PATH="${BASH_SOURCE[0]}"

# Colors -
GREEN='\033[1;32m'
PURPLE='\033[1;35m'
CYAN='\033[1;36m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
RESET='\033[0m'

echo -e "${CYAN}ℹ Executing: $SELF_PATH${RESET}\n"

# ============================================
# Utility Functions
# ============================================

# Logging functions
log_step() {
    echo -e "\n${PURPLE}▶ $1${RESET}"
}

log_success() {
    echo -e "${GREEN}✓ $1${RESET}"
}

log_info() {
    echo -e "${CYAN}ℹ $1${RESET}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${RESET}"
}

log_error() {
    echo -e "${RED}✗ $1${RESET}"
}

success() {
    bash -c "$@" &> /dev/null
}

command_exists() {
    command -v ${1} &> /dev/null
}

# Log a command and return falsey in dry run mode
not_dry() {
    message="$@"
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}[DRY RUN]${RESET} $message"
        return 1
    else
        log_info "$message"
        return 0
    fi
}
# Prompt user to continue after failure
prompt_continue() {
    local message="$1"
    echo -e "\n${RED}═══════════════════════════════════════${RESET}"
    log_error "$message"
    echo -e "${RED}═══════════════════════════════════════${RESET}\n"

    # In no-input mode, we assume continuation
    if [[ "$NO_INPUT" == true ]]; then
        log_warning "Continuing despite error (non-interactive mode)..."
        return
    fi

    echo -e "${YELLOW}Do you want to continue anyway? (y/n):${RESET} "
    read -r response < /dev/tty

    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Exiting setup script"
        exit 1
    fi

    log_warning "Continuing despite error..."
}

# ============================================
# Argument Parsing
# ============================================
DRY_RUN=false
NO_INPUT=false

# Get existing git config or set to empty string. Arguments will override this.
GIT_NAME=$(git config --global user.name || echo "")
GIT_EMAIL=$(git config --global user.email || echo "")
ARG_GITHUB_TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-input)
      NO_INPUT=true
      shift
      ;;
    --git-name)
      GIT_NAME="$2"
      shift 2
      ;;
    --git-email)
      GIT_EMAIL="$2"
      shift 2
      ;;
    --github-token)
      ARG_GITHUB_TOKEN="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done


# ============================================
# Mode Selection
# ============================================
# The --dry-run flag is handled by the argument parser.
# We only prompt if no flags were passed and we are in interactive mode.
if [[ "$NO_INPUT" == false ]] && [[ "$DRY_RUN" == false ]]; then
    echo -e "${CYAN}Run in dry-run mode? (y/n):${RESET} "
    read -r dry_response < /dev/tty

    if [[ "$dry_response" =~ ^[Yy]$ ]]; then
        DRY_RUN=true
    fi
fi

# ============================================
# Banner
# ============================================
echo ""
echo -e "${GREEN}"
cat << "EOF"
     _____              
    / __  \           __  _
   / /_/ /___  ____  / /_(_)
  / __ \/ __ \/ __ \/ __/ /
 / /_/ / /_/ / /_/ / /_/ /
/_.___/\____/\____/\__/_/
            
EOF
echo -e "${RESET}"
echo -e "   ${GREEN}Development{PURPLE}booti${RESET} Bootstrap Script"
if [[ "$DRY_RUN" == true ]]; then
    echo -e "   ${YELLOW}[DRY RUN MODE]${RESET} - No changes will be made"
fi
echo ""

# ============================================
# Preflight Checks
# ============================================
log_step "Running preflight checks..."

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    log_error "This script is designed for macOS only"
    exit 1
fi

log_success "Running on macOS"

ZSHRC_FILE="${HOME}/.zshrc"

if [[ -f "${ZSHRC_FILE}" ]]; then
    log_success "${ZSHRC_FILE} already exists"
elif not_dry "Creating ${ZSHRC_FILE}..."; then
    touch "${ZSHRC_FILE}"
    log_success "Created ${ZSHRC_FILE}"
fi

# ============================================
# Step 1: Install Homebrew
# ============================================
log_step "Homebrew"

if command_exists "brew"; then
    log_success "Homebrew already installed"
else
    if not_dry "Installing Homebrew..."; then
        {
            bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            # Add Homebrew to PATH for Apple Silicon Macs
            if [[ $(uname -m) == 'arm64' ]] && not_dry "Adding Homebrew to PATH for Apple Silicon Macs..."; then
                bash -c 'echo '\''eval "$(/opt/homebrew/bin/brew shellenv)"'\'' >> ~/.zprofile'
                eval "$(/opt/homebrew/bin/brew shellenv)"
            fi
            log_success "Homebrew installed successfully"
        } || {
            prompt_continue "Failed to install Homebrew"
        }
    fi
fi

# ============================================
# Step 2: Install Brew Dependencies from Brewfile
# ============================================
log_step "Installing Homebrew packages from Brewfile..."

BREW_FILE="${HOME}/.Brewfile"

if not_dry "Creating ${BREW_FILE}..."; then
cat << "EOF" > "${BREW_FILE}"
# Taps
tap "xcodesorg/made"

# Formulae
brew "cjson"
brew "cmake"
brew "defaultbrowser"
brew "ffmpeg"
brew "fizz"
brew "gettext"
brew "gh"
brew "jq"
brew "mysql-client@8.0"
brew "npm"
brew "openssl@3"
brew "python@3.12"
brew "python@3.13"
brew "ruby-install"
brew "scrcpy"
brew "sqlite"
brew "tmux"
brew "uv"
brew "watchman"
brew "xcodes"
brew "yarn"

# Casks
cask "google-chrome"
cask "cursor"
cask "slack"
cask "gcloud-cli"
cask "ghostty"
cask "tuple"
cask "spotify"
cask "logitune"
EOF
fi

if not_dry "Installing Homebrew packages from ${BREW_FILE}..."; then
    {
        brew bundle install --file="${BREW_FILE}"
        log_success "All Homebrew packages installed"
    } || {
        prompt_continue "Some Homebrew packages failed to install"
    }
fi

# ============================================
# Step 2b: Configure Google Cloud SDK Path
# ============================================
log_step "Configuring Google Cloud SDK path..."

# As per Homebrew's instructions for the gcloud cask, we may need to add its bin directory to the PATH.
# We check if the line already exists in .zshrc before adding it.
GCLOUD_SDK_BIN="/opt/homebrew/share/google-cloud-sdk/bin"
GCLOUD_PATH_STRING="export PATH=${GCLOUD_SDK_BIN}:\"\$PATH\""

if [[ -f "${ZSHRC_FILE}" ]] && grep -Fxq "$GCLOUD_PATH_STRING" "${ZSHRC_FILE}"; then
    log_success "Google Cloud SDK path already in ZSHRC"
elif not_dry "Adding Google Cloud SDK path to ZSHRC..."; then
    echo "" >> "${ZSHRC_FILE}" # Add a newline for separation
    echo "# Add Google Cloud SDK to PATH" >> "${ZSHRC_FILE}"
    echo "$GCLOUD_PATH_STRING" >> "${ZSHRC_FILE}"
    log_success "Google Cloud SDK path added to ZSHRC"
fi

# Also export for the current session to find the gcloud command later in this script
export PATH="${GCLOUD_SDK_BIN}:$PATH"

# ============================================
# Step 2c: Set Default Browser
# ============================================
log_step "Setting Google Chrome as default browser..."

if not_dry "Setting Google Chrome as default browser..." && command_exists defaultbrowser; then
    {
        defaultbrowser chrome
        log_success "Google Chrome set as default browser"
    } || {
        prompt_continue "Failed to set default browser"
    }
else
    # This else block is reached if it's a dry run OR if the command doesn't exist.
    # We can distinguish between the two cases.
    if not_dry "Handling missing defaultbrowser utility" &> /dev/null; then
        # This is the real-run, command-not-found case
        log_warning "defaultbrowser command not found. Skipping."
    else
        # This is the dry-run case
        log_success "Default browser setting would be handled here."
    fi
fi

# ============================================
# Step 3: Install Xcode Command Line Tools and Xcode
# ============================================
log_step "Installing Xcode Command Line Tools..."

# Check if already installed
if xcode-select -p &>/dev/null; then
    log_success "Xcode Command Line Tools already installed at $(xcode-select -p)"
elif not_dry "Installing Xcode Command Line Tools..."; then
    # Try to install - this may show a dialog or say already installed
    install_output=$(xcode-select --install 2>&1)

    # Check if already installed (different state)
    if echo "$install_output" | grep -q "already installed"; then
        log_success "Xcode Command Line Tools already installed"
        log_info "To check for updates, run: softwareupdate --list"
    else
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
            prompt_continue "Xcode Command Line Tools installation failed or incomplete"
        fi
    fi
fi

if success "xcodes -h"; then
    log_success "Xcode already installed"
elif not_dry "Installing Xcode..."; then
    xcodes install
    log_success "Xcode installed successfully"
fi

# ============================================
# Step 4: Setup Ghostty config
# ============================================
log_step "Setting up Ghostty terminal configuration..."

GHOSTTY_DIR="${HOME}/Library/Application Support/com.mitchellh.ghostty"

if not_dry "Creating Ghostty configuration directory and file..."; then
    {
        mkdir -p "${GHOSTTY_DIR}"
        cat << "EOF" > "${GHOSTTY_DIR}/config"
maximize = true
shell-integration = zsh
clipboard-read = allow
clipboard-write = allow
window-subtitle = working-directory
window-theme = system
window-show-tab-bar = auto
theme = iTerm2 Solarized Dark
background = #000000
foreground = #00FF05
selection-background = #c1deff
selection-foreground = #000000
cursor-color = #c7c7c7
cursor-text = #8c8c8c
split-divider-color = "#FFFFFF"
palette = 0=#000000
palette = 1=#c91b00
palette = 2=#00c200
palette = 3=#c7c400
palette = 4=#0225c7
palette = 5=#ca30c7
palette = 6=#00c5c7
palette = 7=#c7c7c7
palette = 8=#686868
palette = 9=#ff6e67
palette = 10=#5ffa68
palette = 11=#fffc67
palette = 12=#6871ff
palette = 13=#ff77ff
palette = 14=#60fdff
palette = 15=#ffffff
macos-titlebar-style = native
font-size = 16

# Keybindings
keybind = global:cmd+backquote=toggle_quick_terminal
keybind = shift+enter=text:\x1b\r
EOF
        log_success "Ghostty configuration created."
    } || {
        prompt_continue "Failed to create Ghostty configuration file."
    }
fi

GHOSTTY_ZSH_STRING='function set_ghostty_title {
  print -Pn "\e]0;%n@%m: %~ \a"
  print -Pn "\e]7;file://$(hostname)$(pwd)\a"
}
precmd_functions+=(set_ghostty_title)'

if [[ -f "${ZSHRC_FILE}" ]] && grep -Fxq "$GHOSTTY_ZSH_STRING" "${ZSHRC_FILE}"; then
    log_success "Ghostty ZSH source line already present in ZSHRC"
elif not_dry "Adding Ghostty ZSH source line to ZSHRC..."; then
    echo "$GHOSTTY_ZSH_STRING" >> "${ZSHRC_FILE}"
    log_success "Ghostty ZSH source line added to ZSHRC"
fi

# ============================================
# Step 5: Setup Cursor
# ============================================
log_step "Setting up VS Code and Cursor configurations..."

# Cursor configs
CURSOR_DIR="${HOME}/Library/Application Support/Cursor/User"

if not_dry "Adding Cursor settings/keybindings..."; then
    {
        mkdir -p "${CURSOR_DIR}"
        cat << "EOF" > "${CURSOR_DIR}/settings.json"
{
    "window.commandCenter": true,
    "workbench.preferredLightColorTheme": "Kevinmind Light",
    "workbench.preferredDarkColorTheme": "Kevinmind Dark",
    "workbench.colorTheme": "Kevinmind Dark",
    "cursor.cpp.enablePartialAccepts": true,
    "workbench.sideBar.location": "right",
    "cursor.enable_agent_window_setting": true,
    "git.autofetch": true,
    "cursor.agent_layout_browser_beta_setting": true,
    "window.autoDetectColorScheme": true,
    "git.openRepositoryInParentFolders": "always",
    "diffEditor.ignoreTrimWhitespace": false,
    "claudeCode.preferredLocation": "sidebar",
    "workbench.editor.enablePreview": false,
    "claudeCode.disableLoginPrompt": true,
    "claudeCode.initialPermissionMode": "plan",
    "claudeCode.useTerminal": true
}
EOF
        cat << "EOF" > "${CURSOR_DIR}/keybindings.json"
[
    {
        "key": "shit+cmd+k",
        "command": "cursorai.action.generateInTerminal",
        "when": "terminalFocus && terminalHasBeenCreated || terminalFocus && terminalProcessSupported || terminalHasBeenCreated && terminalPromptBarVisible || terminalProcessSupported && terminalPromptBarVisible"
    },
    {
        "key": "cmd+i",
        "command": "composerMode.agent"
    },
    {
        "key": "cmd+k",
        "command": "workbench.action.terminal.clear",
        "when": "terminalFocus"
    }
]
EOF
        log_success "Cursor configured"
    } || {
        prompt_continue "Failed to write Cursor configuration files."
    }
fi

# ============================================
# Step 5b: Install Kevinmind Theme
# ============================================
log_step "Installing Kevinmind theme for Cursor..."

if not_dry "Installing Kevinmind theme extension..."; then
    {
        curl -L $(curl -s https://api.github.com/repos/KevinMind/theme/releases/latest | grep -o 'https://.*\.vsix' | head -1) -o /tmp/kevinmind.vsix && cursor --install-extension /tmp/kevinmind.vsix && rm /tmp/kevinmind.vsix
        log_success "Kevinmind theme installed successfully"
    } || {
        prompt_continue "Failed to install Kevinmind theme"
    }
fi


# ============================================
# Step 6: Install NVM
# ============================================
log_step "Installing NVM (Node Version Manager)..."

# Check if NVM is available (it's a shell function, not a binary)
if [[ -s "$HOME/.nvm/nvm.sh" ]] && command -v nvm &> /dev/null; then
    log_success "NVM already installed"
elif [[ -s "$HOME/.nvm/nvm.sh" ]] && not_dry "NVM already installed (sourcing)"; then
    source "$HOME/.nvm/nvm.sh"
elif not_dry "Installing NVM..."; then
    {
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        log_success "NVM installed successfully"
    } || {
        prompt_continue "Failed to install NVM"
    }
fi

NVM_SOURCE_STRING='export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion'

if [[ -f "${ZSHRC_FILE}" ]] && grep -Fxq "$NVM_SOURCE_STRING" "${ZSHRC_FILE}"; then
    log_success "NVM source line already present in ZSHRC"
elif not_dry "Adding NVM source line to ZSHRC..."; then
    echo "$NVM_SOURCE_STRING" >> "${ZSHRC_FILE}"
    log_success "NVM source line added to ZSHRC"
fi

# ============================================
# Step 7: Configure Git
# ============================================
log_step "Configuring Git..."

# In interactive mode, we confirm/update the values.
# In --no-input mode, we use the values as-is (from git config or arguments).
if [[ "$NO_INPUT" == false ]]; then
    # Interactive prompt for Git Name
    if [[ -n "$GIT_NAME" ]]; then
        echo -e "\n${CYAN}Current Git user name: \"${GIT_NAME}\"${RESET}"
        echo -e "${CYAN}Do you want to change this name? (y/N):${RESET} "
        read -r change_name < /dev/tty
        if [[ "$change_name" =~ ^[Yy]$ ]]; then
            echo -e "${CYAN}Enter your full name for Git:${RESET} "
            read -r GIT_NAME < /dev/tty
        fi
    else
        echo -e "\n${CYAN}Enter your full name for Git:${RESET} "
        read -r GIT_NAME < /dev/tty
    fi

    # Interactive prompt for Git Email
    if [[ -n "$GIT_EMAIL" ]]; then
        echo -e "${CYAN}Current Git email: \"${GIT_EMAIL}\"${RESET}"
        echo -e "${CYAN}Do you want to change this email? (y/N):${RESET} "
        read -r change_email < /dev/tty
        if [[ "$change_email" =~ ^[Yy]$ ]]; then
            echo -e "${CYAN}Enter your email:${RESET} "
            read -r GIT_EMAIL < /dev/tty
        fi
    else
        echo -e "${CYAN}Enter your email:${RESET} "
        read -r GIT_EMAIL < /dev/tty
    fi
fi

# Apply Git Config
if [[ -n "$GIT_NAME" && -n "$GIT_EMAIL" ]]; then
    if not_dry "Configuring Git with name: $GIT_NAME and email: $GIT_EMAIL..."; then
        {
            git config --global user.name "$GIT_NAME"
            git config --global user.email "$GIT_EMAIL"
            git config --global core.editor "cursor -w"
            log_success "Git configured with name: $GIT_NAME and email: $GIT_EMAIL"
        } || {
            prompt_continue "Failed to configure Git"
        }
    fi
else
    log_warning "Git name or email not provided, skipping git configuration"
    prompt_continue "Git configuration was not completed"
fi

git config --global http.postBuffer 524288000

# Remove low speed settings if they exist
git config --global --unset http.lowSpeedLimit 2>/dev/null || true
git config --global --unset http.lowSpeedTime 2>/dev/null || true

# ============================================
# Step 9: Authorize GitHub CLI
# ============================================
log_step "Authorizing GitHub CLI..."

if ! command_exists gh; then
    log_error "gh not found in PATH"
    log_info "Try: brew install gh"
    prompt_continue "Cannot authenticate gh (not found in PATH)"
else
    # Check if already authenticated
    if gh auth status &>/dev/null; then
        log_success "GitHub CLI already authorized"
    elif [[ -n "$ARG_GITHUB_TOKEN" ]]; then
        if not_dry "Authenticating GitHub CLI with provided token..."; then
            if echo "$ARG_GITHUB_TOKEN" | gh auth login --with-token; then
                log_success "GitHub CLI authorized"
            else
                prompt_continue "GitHub CLI token authentication failed"
            fi
        fi
    elif [[ "$NO_INPUT" == false ]]; then
        if not_dry "Starting GitHub CLI authentication..."; then
            log_info "Follow the prompts below to authenticate:"
            echo ""
            if gh auth login --hostname github.com --git-protocol https --web; then
                log_success "GitHub CLI authorized"
            else
                prompt_continue "GitHub CLI authentication failed"
            fi
        fi
    else
        log_warning "Skipping GitHub CLI authentication (non-interactive mode and no token provided)"
    fi
fi

# ============================================
# Final Steps
# ============================================
echo -e "\n${GREEN}════════════════════════════════════════${RESET}"
log_success "Bootstrap complete!"
echo -e "${GREEN}════════════════════════════════════════${RESET}\n"

log_info "Next steps:"
echo -e "  ${CYAN}1.${RESET} Restart your terminal"
echo -e "  ${CYAN}2.${RESET} Configure Cursor and other apps"
echo -e "  ${CYAN}3.${RESET} Sign in to Slack, Chrome, and other apps"

echo -e "\n${GREEN}Booti${PURPLE}booti${RESET} says: ${PURPLE}Happy coding! 🎉${RESET}\n"

# ============================================
# Cleanup
# ============================================
echo -e "\n${CYAN}ℹ Cleaning up temporary directory...${RESET}"
# rm -f "$SELF_PATH"
