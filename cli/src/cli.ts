import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import type { CliOptions } from './types';

/**
 * Get the version from VERSION file (set at build time from GitHub release tag)
 * Falls back to 'dev' for local development
 */
function getVersion(): string {
  // Try to read VERSION file from the same directory as the binary
  const versionPaths = [
    join(dirname(process.execPath), 'VERSION'),  // Next to binary (production)
    join(process.cwd(), 'VERSION'),               // Current working directory
    join(dirname(import.meta.path), '..', '..', 'VERSION'),  // Relative to source (dev)
  ];

  for (const versionPath of versionPaths) {
    if (existsSync(versionPath)) {
      try {
        return readFileSync(versionPath, 'utf-8').trim();
      } catch {
        // Continue to next path
      }
    }
  }

  return 'dev';
}

const HELP_TEXT = `
Usage: booti [command] [options]

Bootstrap your macOS development environment.

Commands:
  (default)             Run setup steps to configure your environment
  push                  Push local config files back to the repo via PR
  upgrade               Download and install the latest booti release

Options:
  --dry-run             Run in dry-run mode, no changes will be made
  --no-input            Run in non-interactive mode, using defaults
  --steps <steps>       Run only specified steps (comma-separated)
  --list                List all available steps and exit
  --backup              Sync local files back to repo templates
  --verbose             Show detailed output
  --quiet               Suppress non-essential output
  --git-name <name>     Set the git user name
  --git-email <email>   Set the git user email
  --github-token <token> Set the GitHub auth token
  --help                Show this help message
  --version             Show version number

Examples:
  booti                              # Interactive bootstrap
  booti --dry-run                    # Preview changes
  booti --steps homebrew,cursor      # Run specific steps
  booti --backup                     # Backup local files to templates
  booti --backup --dry-run           # Preview backup changes
  booti --no-input --git-name "Kevin" --git-email "user@example.com"
  booti push                         # Sync local configs to repo
  booti push --dry-run               # Preview what would be synced
  booti upgrade                      # Upgrade to latest release
`;

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    subcommand: 'run',
    dryRun: false,
    noInput: false,
    list: false,
    backup: false,
    verbose: false,
    quiet: false,
  };

  const args = argv.slice(2); // Skip node and script path

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case 'push':
        options.subcommand = 'push';
        break;

      case 'upgrade':
        options.subcommand = 'upgrade';
        break;

      case '--dry-run':
        options.dryRun = true;
        break;

      case '--no-input':
        options.noInput = true;
        break;

      case '--steps':
        if (nextArg) {
          options.steps = nextArg.split(',').map(s => s.trim());
          i++;
        }
        break;

      case '--list':
        options.list = true;
        break;

      case '--backup':
        options.backup = true;
        break;

      case '--verbose':
        options.verbose = true;
        break;

      case '--quiet':
        options.quiet = true;
        break;

      case '--git-name':
        if (nextArg) {
          options.gitName = nextArg;
          i++;
        }
        break;

      case '--git-email':
        if (nextArg) {
          options.gitEmail = nextArg;
          i++;
        }
        break;

      case '--github-token':
        if (nextArg) {
          options.githubToken = nextArg;
          i++;
        }
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);

      case '--version':
      case '-v':
        printVersion();
        process.exit(0);

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          console.error('Run with --help for usage information');
          process.exit(1);
        }
    }
  }

  return options;
}

export function printHelp(): void {
  console.log(HELP_TEXT);
}

export function printVersion(): void {
  console.log(`booti ${getVersion()}`);
}

/**
 * Build variable overrides from CLI options
 */
export function buildVariableOverrides(options: CliOptions): Record<string, string> {
  const overrides: Record<string, string> = {};

  if (options.gitName) overrides.GIT_NAME = options.gitName;
  if (options.gitEmail) overrides.GIT_EMAIL = options.gitEmail;
  if (options.githubToken) overrides.GITHUB_TOKEN = options.githubToken;

  return overrides;
}
