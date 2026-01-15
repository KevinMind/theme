import chalk from 'chalk';

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
}

export interface Logger {
  success(message: string): void;
  error(message: string): void;
  warning(message: string): void;
  info(message: string): void;
  step(name: string, description: string): void;
  dryRun(message: string): void;
  debug(message: string): void;
  banner(): void;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const { quiet = false, verbose = false } = options;

  return {
    success(message: string) {
      if (!quiet) {
        console.log(chalk.green(`✓ ${message}`));
      }
    },

    error(message: string) {
      console.error(chalk.red(`✗ ${message}`));
    },

    warning(message: string) {
      if (!quiet) {
        console.log(chalk.yellow(`⚠ ${message}`));
      }
    },

    info(message: string) {
      if (!quiet) {
        console.log(chalk.cyan(`ℹ ${message}`));
      }
    },

    step(name: string, description: string) {
      if (!quiet) {
        console.log();
        console.log(chalk.magenta(`▶ ${name}`));
        if (verbose && description) {
          console.log(chalk.gray(`  ${description}`));
        }
      }
    },

    dryRun(message: string) {
      if (!quiet) {
        console.log(chalk.yellow(`[DRY RUN] ${message}`));
      }
    },

    debug(message: string) {
      if (verbose) {
        console.log(chalk.gray(`[DEBUG] ${message}`));
      }
    },

    banner() {
      if (!quiet) {
        console.log();
        console.log(chalk.green(`
     _____
    / __  \\           __  _
   / /_/ /___  ____  / /_(_)
  / __ \\/ __ \\/ __ \\/ __/ /
 / /_/ / /_/ / /_/ / /_/ /
/_.___/\\____/\\____/\\__/_/
        `));
        console.log(chalk.cyan('   Development Bootstrap CLI'));
        console.log();
      }
    },
  };
}

// Default logger instance
export const logger = createLogger();
