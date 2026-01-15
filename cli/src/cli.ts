import type { CliOptions } from './types';

const HELP_TEXT = `
Usage: booti [options]

Bootstrap your macOS development environment.

Options:
  --dry-run             Run in dry-run mode, no changes will be made
  --no-input            Run in non-interactive mode, using defaults
  --steps <steps>       Run only specified steps (comma-separated)
  --list                List all available steps and exit
  --verbose             Show detailed output
  --quiet               Suppress non-essential output
  --git-name <name>     Set the git user name
  --git-email <email>   Set the git user email
  --gt-token <token>    Set the Graphite auth token
  --github-token <token> Set the GitHub auth token
  --help                Show this help message
  --version             Show version number

Examples:
  booti                              # Interactive bootstrap
  booti --dry-run                    # Preview changes
  booti --steps homebrew,cursor      # Run specific steps
  booti --no-input --git-name "Kevin" --git-email "kevin@example.com"
`;

const VERSION = '1.0.0';

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    noInput: false,
    list: false,
    verbose: false,
    quiet: false,
  };

  const args = argv.slice(2); // Skip node and script path

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
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

      case '--gt-token':
        if (nextArg) {
          options.gtToken = nextArg;
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
  console.log(`booti v${VERSION}`);
}

/**
 * Build variable overrides from CLI options
 */
export function buildVariableOverrides(options: CliOptions): Record<string, string> {
  const overrides: Record<string, string> = {};

  if (options.gitName) overrides.GIT_NAME = options.gitName;
  if (options.gitEmail) overrides.GIT_EMAIL = options.gitEmail;
  if (options.gtToken) overrides.GRAPHITE_TOKEN = options.gtToken;
  if (options.githubToken) overrides.GITHUB_TOKEN = options.githubToken;

  return overrides;
}
