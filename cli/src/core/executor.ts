import { join } from 'path';
import { homedir } from 'os';
import type { DiscoveredStep, ExecutionContext, ExecutionResult, CollectedVariables } from '../types';
import { syncTemplates } from './templates';
import { variablesToEnv } from './variables';
import { runScript } from '../utils/spawn';
import { logger } from './logger';

/**
 * Execute all steps in order
 */
export async function executeSteps(
  steps: DiscoveredStep[],
  order: string[],
  context: ExecutionContext
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  const stepMap = new Map(steps.map(s => [s.id, s]));

  for (const stepId of order) {
    const step = stepMap.get(stepId);
    if (!step) {
      results.push({
        step: stepId,
        success: false,
        error: new Error(`Step not found: ${stepId}`),
      });
      continue;
    }

    // Check platform compatibility
    const currentPlatform = process.platform;
    if (!step.config.platforms.includes(currentPlatform as 'darwin' | 'linux' | 'win32')) {
      results.push({
        step: stepId,
        success: true,
        skipped: true,
        skipReason: `Not supported on ${currentPlatform}`,
      });
      continue;
    }

    const result = await executeStep(step, context);
    results.push(result);

    // Stop on failure
    if (!result.success && !result.skipped) {
      logger.error(`Step ${stepId} failed, stopping execution`);
      break;
    }
  }

  return results;
}

/**
 * Execute a single step
 */
export async function executeStep(
  step: DiscoveredStep,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const { dryRun, variables, homeDir } = context;

  logger.step(step.config.name, step.config.description);

  // Build environment for shell scripts
  const env = variablesToEnv(variables, step.id);

  try {
    // Phase 1: Run pre.sh if exists
    if (step.hasPreScript) {
      const preScriptPath = join(step.directory, 'pre.sh');
      logger.info(`Running pre-installation script...`);

      const result = await runScript(preScriptPath, {
        dryRun,
        env,
        cwd: step.directory,
      });

      if (result.exitCode !== 0) {
        return {
          step: step.id,
          success: false,
          error: new Error(`Pre-script failed with exit code ${result.exitCode}`),
        };
      }
    }

    // Phase 2: Sync templates
    if (step.templateDir && step.config.files.length > 0) {
      logger.info(`Syncing template files...`);
      await syncTemplates(step.templateDir, step.config.files, {
        dryRun,
        variables,
        homeDir,
      });
    }

    // Phase 3: Run post.sh if exists
    if (step.hasPostScript) {
      const postScriptPath = join(step.directory, 'post.sh');
      logger.info(`Running post-installation script...`);

      const result = await runScript(postScriptPath, {
        dryRun,
        env,
        cwd: step.directory,
      });

      if (result.exitCode !== 0) {
        return {
          step: step.id,
          success: false,
          error: new Error(`Post-script failed with exit code ${result.exitCode}`),
        };
      }
    }

    logger.success(`Completed: ${step.config.name}`);
    return { step: step.id, success: true };

  } catch (error) {
    return {
      step: step.id,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
