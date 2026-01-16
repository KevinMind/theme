import { readdir } from 'fs/promises';
import { join } from 'path';
import { StepSchema } from '../schemas/step';
import { fileExists, isDirectory, readJson } from '../utils/fs';
import type { DiscoveredStep } from '../types';
import { logger } from './logger';

/**
 * Discover all steps in the steps directory
 */
export async function discoverSteps(stepsDir: string): Promise<DiscoveredStep[]> {
  const steps: DiscoveredStep[] = [];

  if (!await isDirectory(stepsDir)) {
    logger.warning(`Steps directory not found: ${stepsDir}`);
    return steps;
  }

  const entries = await readdir(stepsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const stepDir = join(stepsDir, entry.name);
    const stepJsonPath = join(stepDir, 'step.json');

    if (!await fileExists(stepJsonPath)) {
      logger.debug(`Skipping ${entry.name}: no step.json found`);
      continue;
    }

    try {
      const step = await loadStepConfig(stepDir);
      steps.push(step);
    } catch (error) {
      logger.warning(`Failed to load step ${entry.name}: ${error}`);
    }
  }

  return steps;
}

/**
 * Load and validate a step configuration from a directory
 */
export async function loadStepConfig(stepDir: string): Promise<DiscoveredStep> {
  const stepJsonPath = join(stepDir, 'step.json');
  const rawConfig = await readJson(stepJsonPath);

  // Validate with Zod schema
  const config = StepSchema.parse(rawConfig);

  // Check for pre.sh and post.sh
  const preScriptPath = join(stepDir, 'pre.sh');
  const postScriptPath = join(stepDir, 'post.sh');
  const templateDirPath = join(stepDir, 'templates');

  const hasPreScript = await fileExists(preScriptPath);
  const hasPostScript = await fileExists(postScriptPath);
  const hasTemplateDir = await isDirectory(templateDirPath);

  return {
    id: stepDir.split('/').pop()!,
    config,
    directory: stepDir,
    hasPreScript,
    hasPostScript,
    templateDir: hasTemplateDir ? templateDirPath : null,
  };
}

/**
 * Find the steps directory relative to the CLI
 */
export async function findStepsDir(cliDir: string): Promise<string> {
  // Check for environment variable override first
  if (process.env.BOOTI_STEPS_DIR) {
    const envDir = process.env.BOOTI_STEPS_DIR;
    if (await isDirectory(envDir)) {
      return envDir;
    }
    logger.warning(`BOOTI_STEPS_DIR set but not found: ${envDir}`);
  }

  // For compiled binaries, use the executable path
  const execDir = join(process.execPath, '..');

  // Try common locations
  const candidates = [
    join(cliDir, '..', 'steps'),        // ../steps from cli/src/
    join(cliDir, '..', '..', 'steps'),  // ../../steps from cli/src/ (dev mode)
    join(cliDir, 'steps'),               // ./steps same directory
    join(execDir, 'steps'),              // ./steps relative to binary
    join(execDir, '..', 'steps'),        // ../steps relative to binary
  ];

  for (const candidate of candidates) {
    if (await isDirectory(candidate)) {
      return candidate;
    }
  }

  // Default to sibling steps directory
  return join(cliDir, '..', '..', 'steps');
}
