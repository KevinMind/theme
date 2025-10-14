# theme
My cursor/code theme

## Installation

Install the latest release with this one-liner:

```bash
curl -L $(curl -s https://api.github.com/repos/KevinMind/theme/releases/latest | grep -o 'https://.*\.vsix' | head -1) -o /tmp/kevinmind.vsix && cursor --install-extension /tmp/kevinmind.vsix && rm /tmp/kevinmind.vsix
```

This command will:
1. Download the latest release from GitHub
2. Install it to Cursor
3. Clean up the temporary file
