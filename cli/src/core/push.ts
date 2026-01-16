import { homedir } from 'os';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { exec } from '../utils/exec';
import { isFile, readText, writeText, ensureDir, readJson } from '../utils/fs';
import { createLogger } from './logger';
import type { FileConfig } from '../schemas/step';
import { StepSchema } from '../schemas/step';

const logger = createLogger();

/**
 * Find all placeholder locations in a JSON object
 * Returns an array of { path, placeholder } for each ${VAR} found
 */
export function findPlaceholders(obj: unknown, path: string[] = []): { path: string[]; placeholder: string }[] {
  const results: { path: string[]; placeholder: string }[] = [];

  if (typeof obj === 'string') {
    const match = obj.match(/\$\{([^}]+)\}/);
    if (match) {
      results.push({ path, placeholder: obj });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      results.push(...findPlaceholders(item, [...path, String(index)]));
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      results.push(...findPlaceholders(value, [...path, key]));
    }
  }

  return results;
}

/**
 * Get a value at a path in an object
 */
export function getAtPath(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const key of path) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Set a value at a path in an object
 */
export function setAtPath(obj: unknown, path: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    }
  }
  if (current && typeof current === 'object') {
    (current as Record<string, unknown>)[path[path.length - 1]] = value;
  }
}

/**
 * Sanitize local content by restoring placeholders from template
 */
export function sanitizeWithTemplate(
  localContent: string,
  templateContent: string
): { sanitized: string; replacements: string[] } {
  const replacements: string[] = [];

  let localJson: unknown;
  let templateJson: unknown;

  try {
    localJson = JSON.parse(localContent);
    templateJson = JSON.parse(templateContent);
  } catch {
    // Not JSON, return as-is
    return { sanitized: localContent, replacements: [] };
  }

  const placeholderLocations = findPlaceholders(templateJson);

  for (const { path, placeholder } of placeholderLocations) {
    const localValue = getAtPath(localJson, path);

    if (localValue !== undefined && localValue !== placeholder && typeof localValue === 'string') {
      setAtPath(localJson, path, placeholder);
      const displayValue = localValue.length > 20
        ? `${localValue.slice(0, 8)}...${localValue.slice(-4)}`
        : localValue;
      replacements.push(`${path.join('.')}: "${displayValue}" → "${placeholder}"`);
    }
  }

  const sanitized = JSON.stringify(localJson, null, 2);
  return { sanitized, replacements };
}

interface StepFileConfig {
  stepDir: string;
  stepName: string;
  fileConfig: FileConfig;
}

/**
 * Discover all file configs from step.json files
 */
async function discoverFileConfigs(stepsDir: string): Promise<StepFileConfig[]> {
  const configs: StepFileConfig[] = [];

  const { readdir } = await import('fs/promises');
  let dirs: string[];
  try {
    dirs = await readdir(stepsDir);
  } catch {
    return configs;
  }

  for (const dir of dirs) {
    const stepJsonPath = join(stepsDir, dir, 'step.json');
    if (!(await isFile(stepJsonPath))) continue;

    try {
      const rawConfig = await readJson<unknown>(stepJsonPath);
      const parseResult = StepSchema.safeParse(rawConfig);
      if (!parseResult.success) continue;

      for (const fileConfig of parseResult.data.files) {
        configs.push({
          stepDir: dir,
          stepName: parseResult.data.name,
          fileConfig,
        });
      }
    } catch {
      // Skip invalid steps
    }
  }

  return configs;
}

/**
 * Create a unique branch name
 */
function createBranchName(): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const random = Math.random().toString(36).slice(2, 6);
  return `sync-local-config-${timestamp}-${random}`;
}

export interface PushOptions {
  dryRun?: boolean;
}

/**
 * Push local config files to the repository
 *
 * Simple flow:
 * 1. Verify we're in the booti repo
 * 2. Check git status is clean
 * 3. Discover config files and validate there's work to do
 * 4. Checkout main and pull latest
 * 5. Create new branch
 * 6. Copy sanitized local files to templates
 * 7. Show status and let user handle the rest
 */
export async function pushLocalConfig(options: PushOptions = {}): Promise<void> {
  const { dryRun = false } = options;

  // Step 1: Verify we're in a git repo
  const gitRoot = await exec('git', ['rev-parse', '--show-toplevel']);
  if (!gitRoot.success) {
    logger.error('Not in a git repository. Run this from the booti repo.');
    process.exit(1);
  }

  const repoDir = gitRoot.stdout.trim();
  const stepsDir = join(repoDir, 'steps');

  // Verify it's a booti-style repo by checking for steps directory structure
  if (!(await isFile(join(stepsDir, 'homebrew', 'step.json')))) {
    logger.error('This doesn\'t look like a booti repo. Missing steps/homebrew/step.json.');
    process.exit(1);
  }

  logger.success(`In booti repo: ${repoDir}`);

  // Step 2: Check git status is clean
  console.log();
  logger.info('Checking git status...');
  const status = await exec('git', ['status', '--porcelain'], { cwd: repoDir });

  if (status.stdout.trim()) {
    logger.error('Working directory is not clean. Commit or stash your changes first.');
    console.log(`\n${chalk.gray(status.stdout)}`);
    process.exit(1);
  }
  logger.success('Working directory is clean');

  // Step 3: Discover config files and validate there's work to do (before creating branch)
  console.log();
  logger.info('Discovering config files...');
  const fileConfigs = await discoverFileConfigs(stepsDir);

  if (fileConfigs.length === 0) {
    logger.warning('No config files found in step definitions.');
    return;
  }

  // Check if any local files exist before proceeding
  const existingLocalFiles: StepFileConfig[] = [];
  for (const config of fileConfigs) {
    const localPath = join(homedir(), config.fileConfig.path);
    if (await isFile(localPath)) {
      existingLocalFiles.push(config);
    }
  }

  if (existingLocalFiles.length === 0) {
    logger.warning('No local config files found to sync.');
    return;
  }

  logger.info(`Found ${fileConfigs.length} config file mapping(s), ${existingLocalFiles.length} local file(s)`);

  // Step 4: Checkout main and pull latest
  console.log();
  if (dryRun) {
    logger.dryRun('Would checkout main branch and pull latest');
  } else {
    logger.info('Checking out main branch...');

    const checkoutResult = await exec('git', ['checkout', 'main'], { cwd: repoDir });
    if (!checkoutResult.success) {
      logger.error(`Failed to checkout main: ${checkoutResult.stderr}`);
      process.exit(1);
    }

    const pullResult = await exec('git', ['pull', '--ff-only'], { cwd: repoDir });
    if (!pullResult.success) {
      logger.warning(`Could not pull latest: ${pullResult.stderr}`);
    } else {
      logger.success('Pulled latest from main');
    }
  }

  // Step 5: Create new branch
  const branchName = createBranchName();
  console.log();
  logger.info(`Creating branch: ${branchName}`);

  if (dryRun) {
    logger.dryRun(`Would create branch: ${branchName}`);
  } else {
    const branchResult = await exec('git', ['checkout', '-b', branchName], { cwd: repoDir });
    if (!branchResult.success) {
      logger.error(`Failed to create branch: ${branchResult.stderr}`);
      process.exit(1);
    }
    logger.success(`On branch: ${branchName}`);
  }
  console.log('');

  logger.info('Copying local files to templates...');
  const copiedFiles: string[] = [];
  const allReplacements: string[] = [];

  for (const config of fileConfigs) {
    const localPath = join(homedir(), config.fileConfig.path);
    const templatePath = join(stepsDir, config.stepDir, 'templates', config.fileConfig.path);

    if (!(await isFile(localPath))) {
      console.log(`  ${chalk.gray('•')} ${config.fileConfig.path} ${chalk.gray('(not found locally)')}`);
      continue;
    }

    try {
      const localContent = await readText(localPath);

      // Sanitize if template exists
      let contentToWrite = localContent;
      if (await isFile(templatePath)) {
        const templateContent = await readText(templatePath);
        const { sanitized, replacements } = sanitizeWithTemplate(localContent, templateContent);
        contentToWrite = sanitized;

        if (replacements.length > 0) {
          allReplacements.push(`${config.fileConfig.path}:`);
          allReplacements.push(...replacements.map((r) => `  ${r}`));
        }
      }

      if (dryRun) {
        console.log(`  ${chalk.cyan('•')} ${config.fileConfig.path} → ${config.stepName} ${chalk.gray('(dry-run)')}`);
      } else {
        await ensureDir(dirname(templatePath));
        await writeText(templatePath, contentToWrite);
        console.log(`  ${chalk.green('•')} ${config.fileConfig.path} → ${config.stepName}`);
      }
      copiedFiles.push(config.fileConfig.path);
    } catch (error) {
      logger.warning(`Failed to copy ${config.fileConfig.path}: ${error}`);
    }
  }

  // Show sanitized tokens
  if (allReplacements.length > 0) {
    console.log('');
    logger.info('Sanitized tokens (restored to placeholders):');
    for (const replacement of allReplacements) {
      console.log(`  ${chalk.yellow('•')} ${replacement}`);
    }
  }

  if (copiedFiles.length === 0) {
    logger.warning('No local config files found to sync.');
    return;
  }

  console.log('');

  // Step 6: Show git status
  logger.info('Changes:');
  const diffStat = await exec('git', ['diff', '--stat'], { cwd: repoDir });
  if (diffStat.stdout.trim()) {
    console.log(diffStat.stdout);
  } else {
    logger.success('No changes detected. Local files match templates.');
    return;
  }

  // Final message
  console.log('');
  console.log(`${chalk.bold.green('Done!')} Your local configs have been copied to the templates.`);
  console.log('');
  console.log(`${chalk.cyan('Next steps:')}`);
  console.log(`  1. Review changes:  ${chalk.gray('git diff')}`);
  console.log(`  2. Stage changes:   ${chalk.gray('git add -p')}  ${chalk.gray('(or git add .)')}`);
  console.log(`  3. Commit:          ${chalk.gray('git commit -m "Sync local config"')}`);
  console.log(`  4. Push:            ${chalk.gray(`git push -u origin ${branchName}`)}`);
  console.log(`  5. Open PR:         ${chalk.gray('gh pr create')}`);
  console.log('');
}
