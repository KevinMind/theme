/**
 * Shell helper functions that get injected into pre.sh and post.sh scripts
 */
export const SHELL_HELPERS = `
# Colors
GREEN='\\033[1;32m'
PURPLE='\\033[1;35m'
CYAN='\\033[1;36m'
YELLOW='\\033[1;33m'
RED='\\033[1;31m'
RESET='\\033[0m'

# Logging functions
log_success() {
    echo -e "\${GREEN}✓ \$1\${RESET}"
}

log_error() {
    echo -e "\${RED}✗ \$1\${RESET}"
}

log_warning() {
    echo -e "\${YELLOW}⚠ \$1\${RESET}"
}

log_info() {
    echo -e "\${CYAN}ℹ \$1\${RESET}"
}

# Dry run helper - returns 1 (false) if in dry-run mode
not_dry() {
    local message="\$@"
    if [[ "\${__BOOTI_DRY_RUN__}" == "true" ]]; then
        echo -e "\${YELLOW}[DRY RUN]\${RESET} \$message"
        return 1
    else
        log_info "\$message"
        return 0
    fi
}

# Command existence check
command_exists() {
    command -v \${1} &> /dev/null
}

# Run command silently, return exit status
success() {
    bash -c "\$@" &> /dev/null
}
`;

/**
 * Generate the shell script preamble with helpers and environment
 */
export function generateShellPreamble(
  dryRun: boolean,
  env: Record<string, string>
): string {
  const envExports = Object.entries(env)
    .map(([key, value]) => `export ${key}="${value.replace(/"/g, '\\"')}"`)
    .join('\n');

  return `#!/bin/bash
set -e

# Booti environment
export __BOOTI_DRY_RUN__="${dryRun}"
${envExports}

${SHELL_HELPERS}

# --- Script content below ---
`;
}
