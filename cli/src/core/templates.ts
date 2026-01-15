import { join } from 'path';
import { homedir } from 'os';
import { readText, writeText, copyWithBackup, ensureParentDir, fileExists } from '../utils/fs';
import { jqMerge } from '../utils/json-merge';
import type { FileConfig } from '../schemas/step';
import type { CollectedVariables, SyncOptions } from '../types';
import { logger } from './logger';

/**
 * Substitute variables in content using ${VAR_NAME} syntax
 */
export function substituteVariables(
  content: string,
  variables: CollectedVariables
): string {
  let result = content;

  // Replace collected variables
  for (const [name, { value }] of Object.entries(variables)) {
    const pattern = new RegExp(`\\$\\{${name}\\}`, 'g');
    result = result.replace(pattern, value);
  }

  // Replace standard variables
  result = result.replace(/\$\{HOME\}/g, homedir());
  result = result.replace(/\$\{USER\}/g, process.env.USER || '');

  return result;
}

/**
 * Sync a single file using the replace strategy
 */
async function syncReplace(
  sourcePath: string,
  targetPath: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    logger.dryRun(`Would replace: ${targetPath}`);
    return;
  }

  await copyWithBackup(sourcePath, targetPath);
  logger.success(`Replaced: ${targetPath}`);
}

/**
 * Sync a single file using the jq-merge strategy
 */
async function syncJqMerge(
  sourceContent: string,
  targetPath: string,
  jqPath: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    logger.dryRun(`Would merge into: ${targetPath} at path ${jqPath}`);
    return;
  }

  // Backup existing file if it exists
  if (await fileExists(targetPath)) {
    const { copyFile } = await import('fs/promises');
    await copyFile(targetPath, `${targetPath}.bak`);
  }

  await jqMerge(targetPath, sourceContent, jqPath);
  logger.success(`Merged: ${targetPath} at ${jqPath}`);
}

/**
 * Sync all templates for a step
 */
export async function syncTemplates(
  templateDir: string,
  files: FileConfig[],
  options: SyncOptions
): Promise<void> {
  const { dryRun, variables, homeDir } = options;

  for (const file of files) {
    const sourcePath = join(templateDir, file.path);
    const targetPath = join(homeDir, file.path);

    // Read and substitute variables in source content
    let sourceContent: string;
    try {
      sourceContent = await readText(sourcePath);
      sourceContent = substituteVariables(sourceContent, variables);
    } catch (error) {
      logger.warning(`Template not found: ${sourcePath}`);
      continue;
    }

    // Apply the appropriate sync strategy
    switch (file.strategy) {
      case 'replace': {
        // Write to temp file first, then copy
        const tmpPath = `/tmp/booti-${file.path.replace(/\//g, '-')}`;
        await ensureParentDir(tmpPath);
        await writeText(tmpPath, sourceContent);
        await syncReplace(tmpPath, targetPath, dryRun);
        break;
      }

      case 'jq-merge': {
        if (!file.jq_path) {
          logger.warning(`jq-merge strategy requires jq_path for ${file.path}`);
          continue;
        }
        await syncJqMerge(sourceContent, targetPath, file.jq_path, dryRun);
        break;
      }
    }
  }
}
