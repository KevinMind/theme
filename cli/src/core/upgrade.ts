import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';
import { exec } from '../utils/exec';
import { createLogger } from './logger';

export interface UpgradeOptions {
  dryRun?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

/**
 * Detect the current architecture
 */
function getArchitecture(): 'arm64' | 'x64' {
  const arch = process.arch;
  return arch === 'arm64' ? 'arm64' : 'x64';
}

/**
 * Get the binary pattern for the current architecture
 */
function getBinaryPattern(): string {
  const arch = getArchitecture();
  return arch === 'arm64' ? 'booti-darwin-arm64.tar.gz' : 'booti-darwin-x64.tar.gz';
}

/**
 * Upgrade booti to the latest release
 */
export async function upgradeBooti(options: UpgradeOptions = {}): Promise<void> {
  const { dryRun = false, quiet = false, verbose = false } = options;
  const logger = createLogger({ quiet, verbose });

  const arch = getArchitecture();
  const pattern = getBinaryPattern();
  const binDir = join(homedir(), '.local', 'bin');

  logger.info(`Architecture: ${arch}`);
  logger.info(`Target directory: ${binDir}`);

  // Check if gh CLI is available
  const ghCheck = await exec('which', ['gh']);
  if (!ghCheck.success) {
    logger.error('GitHub CLI (gh) is required but not installed.');
    logger.info('Install it with: brew install gh');
    process.exit(1);
  }

  // Check if gh is authenticated
  const authCheck = await exec('gh', ['auth', 'status']);
  if (!authCheck.success) {
    logger.error('GitHub CLI is not authenticated.');
    logger.info('Run: gh auth login');
    process.exit(1);
  }

  // Get the latest release version for display
  console.log();
  logger.info('Fetching latest release...');
  const releaseInfo = await exec('gh', [
    'release',
    'view',
    '--repo', 'KevinMind/theme',
    '--json', 'tagName,publishedAt',
  ]);

  if (releaseInfo.success) {
    try {
      const info = JSON.parse(releaseInfo.stdout);
      logger.success(`Latest release: ${info.tagName} (${new Date(info.publishedAt).toLocaleDateString()})`);
    } catch {
      // Ignore parse errors
    }
  }

  // Ensure bin directory exists
  console.log();
  if (dryRun) {
    logger.dryRun(`Would ensure directory exists: ${binDir}`);
  } else {
    logger.info(`Ensuring ${binDir} exists...`);
    const mkdirResult = await exec('mkdir', ['-p', binDir]);
    if (!mkdirResult.success) {
      logger.error(`Failed to create directory: ${mkdirResult.stderr}`);
      process.exit(1);
    }
  }

  // Download and extract
  console.log();
  logger.info(`Downloading ${pattern}...`);

  if (dryRun) {
    logger.dryRun(`Would run: gh release download --repo KevinMind/theme --pattern '${pattern}' --output - | tar -xz -C ${binDir}`);
  } else {
    // Use a shell command to pipe gh output to tar
    const downloadCmd = `gh release download --repo KevinMind/theme --pattern '${pattern}' --output - | tar -xz -C '${binDir}'`;

    const result = await exec('sh', ['-c', downloadCmd]);

    if (!result.success) {
      logger.error(`Failed to download and extract: ${result.stderr}`);
      process.exit(1);
    }

    logger.success('Downloaded and extracted successfully');
  }

  // Verify installation
  console.log();
  if (!dryRun) {
    const bootiPath = join(binDir, 'booti');
    const verifyResult = await exec(bootiPath, ['--version']);

    if (verifyResult.success) {
      logger.success(`Installed: ${verifyResult.stdout.trim()}`);
    } else {
      logger.warning('Could not verify installation');
    }
  }

  // Check if bin dir is in PATH
  const pathDirs = (process.env.PATH || '').split(':');
  if (!pathDirs.includes(binDir)) {
    console.log();
    logger.warning(`${binDir} is not in your PATH`);
    console.log();
    console.log(chalk.cyan('Add this to your shell config (~/.zshrc):'));
    console.log(chalk.gray(`  export PATH="$HOME/.local/bin:$PATH"`));
  }

  console.log();
  console.log(chalk.bold.green('Upgrade complete!'));
}
