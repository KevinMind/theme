#!/usr/bin/env bun
import { homedir } from 'os';
import { dirname, join } from 'path';
import { parseArgs, buildVariableOverrides } from './cli';
import { discoverSteps, findStepsDir } from './core/discovery';
import { buildDependencyGraph, getStepById } from './core/dependencies';
import { collectVariableDefinitions, promptForVariables } from './core/variables';
import { executeSteps } from './core/executor';
import { createLogger } from './core/logger';

async function main(): Promise<void> {
  // Parse CLI arguments
  const options = parseArgs(process.argv);

  // Create logger with options
  const log = createLogger({
    quiet: options.quiet,
    verbose: options.verbose,
  });

  // Show banner
  if (!options.list) {
    log.banner();
  }

  if (options.dryRun) {
    log.warning('Running in DRY RUN mode - no changes will be made');
  }

  // Find and discover steps
  const cliDir = dirname(new URL(import.meta.url).pathname);
  const stepsDir = await findStepsDir(cliDir);
  log.debug(`Looking for steps in: ${stepsDir}`);

  const steps = await discoverSteps(stepsDir);

  if (steps.length === 0) {
    log.error('No steps found. Make sure the steps directory exists.');
    process.exit(1);
  }

  log.info(`Found ${steps.length} steps`);

  // List mode - just show steps and exit
  if (options.list) {
    console.log('\nAvailable steps:\n');
    for (const step of steps) {
      console.log(`  ${step.id}`);
      console.log(`    ${step.config.name}: ${step.config.description}`);
      if (step.config.dependencies.length > 0) {
        console.log(`    Dependencies: ${step.config.dependencies.join(', ')}`);
      }
      console.log();
    }
    process.exit(0);
  }

  // Build dependency graph
  const { order, autoIncluded } = buildDependencyGraph(steps, options.steps);

  if (autoIncluded.length > 0) {
    log.info(`Auto-included dependencies: ${autoIncluded.join(', ')}`);
  }

  // Show execution plan
  console.log('\nExecution plan:');
  for (let i = 0; i < order.length; i++) {
    const stepId = order[i];
    const step = getStepById(steps, stepId);
    const autoTag = autoIncluded.includes(stepId) ? ' (dependency)' : '';
    console.log(`  ${i + 1}. ${step?.config.name || stepId}${autoTag}`);
  }
  console.log();

  // Collect variables
  const variableDefs = collectVariableDefinitions(steps, order);
  const overrides = buildVariableOverrides(options);

  const variables = await promptForVariables(variableDefs, overrides, {
    noInput: options.noInput,
  });

  // Execute steps
  log.info('Starting execution...\n');

  const results = await executeSteps(steps, order, {
    dryRun: options.dryRun,
    noInput: options.noInput,
    variables,
    homeDir: homedir(),
    selectedSteps: options.steps,
  });

  // Summary
  console.log('\n' + '═'.repeat(50));
  const successful = results.filter(r => r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;

  if (failed === 0) {
    log.success(`Bootstrap complete! ${successful} steps completed, ${skipped} skipped.`);
  } else {
    log.error(`Bootstrap failed! ${successful} succeeded, ${failed} failed, ${skipped} skipped.`);
    process.exit(1);
  }

  // Next steps
  console.log('\nNext steps:');
  console.log('  1. Restart your terminal');
  console.log('  2. Configure any remaining apps');
  console.log('\nHappy coding! 🎉\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
