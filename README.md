# theme

My cursor/code theme and macOS development bootstrap CLI.

## Theme Installation

Install the latest Cursor theme with this one-liner:

```bash
curl -L $(curl -s https://api.github.com/repos/KevinMind/theme/releases/latest | grep -o 'https://.*\.vsix' | head -1) -o /tmp/kevinmind.vsix && cursor --install-extension /tmp/kevinmind.vsix && rm /tmp/kevinmind.vsix
```

This command will:
1. Download the latest release from GitHub
2. Install it to Cursor
3. Clean up the temporary file

## Booti CLI

Bootstrap your macOS development environment with a single command.

### Install via gh cli (Recommended)

```bash
# Apple Silicon (M1/M2/M3)
gh release download --repo KevinMind/theme --pattern 'booti-darwin-arm64.tar.gz' --output - | tar -xz -C ~/.local/bin

# Intel Mac
gh release download --repo KevinMind/theme --pattern 'booti-darwin-x64.tar.gz' --output - | tar -xz -C ~/.local/bin
```

Make sure `~/.local/bin` is in your PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Usage

```bash
booti                    # Interactive bootstrap
booti --dry-run          # Preview changes without making them
booti --list             # Show available steps
booti --steps homebrew   # Run specific step(s)
booti --help             # Show all options
```

### What it installs

The CLI sets up:
- **Homebrew** - Package manager and system dependencies
- **Xcode CLI** - Command line developer tools
- **Ghostty** - Terminal emulator with custom config
- **Cursor** - Editor settings, keybindings, and theme
- **NVM** - Node.js version manager
- **Git** - User configuration
- **GitHub CLI** - Authentication
- **ZSH** - Shell configuration

### Development

```bash
cd cli
bun install
bun run dev -- --dry-run    # Test locally
bun run build               # Build binary
```
