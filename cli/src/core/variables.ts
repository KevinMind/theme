import { createInterface } from 'readline';
import type { DiscoveredStep, CollectedVariables } from '../types';
import type { Variable } from '../schemas/step';
import { logger } from './logger';

/**
 * Collect all unique variables across steps in execution order
 */
export function collectVariableDefinitions(
  steps: DiscoveredStep[],
  executionOrder: string[]
): Map<string, { variable: Variable; usedBy: string[] }> {
  const variables = new Map<string, { variable: Variable; usedBy: string[] }>();
  const stepMap = new Map(steps.map(s => [s.id, s]));

  for (const stepId of executionOrder) {
    const step = stepMap.get(stepId);
    if (!step) continue;

    for (const [varName, varDef] of Object.entries(step.config.variables)) {
      const existing = variables.get(varName);
      if (existing) {
        existing.usedBy.push(stepId);
      } else {
        variables.set(varName, {
          variable: varDef,
          usedBy: [stepId],
        });
      }
    }
  }

  return variables;
}

/**
 * Prompt user for variable values
 */
export async function promptForVariables(
  variableDefs: Map<string, { variable: Variable; usedBy: string[] }>,
  existingValues: Record<string, string> = {},
  options: { noInput?: boolean } = {}
): Promise<CollectedVariables> {
  const collected: CollectedVariables = {};
  const { noInput = false } = options;

  for (const [varName, { variable, usedBy }] of variableDefs) {
    // Check if we already have a value (from CLI args or environment)
    const existingValue = existingValues[varName] || process.env[varName];

    if (existingValue) {
      collected[varName] = {
        value: existingValue,
        source: 'existing',
        variable,
      };
      continue;
    }

    // In no-input mode, use default or empty string
    if (noInput) {
      if (variable.required && !variable.default) {
        logger.warning(`Variable ${varName} is required but no value provided`);
      }
      collected[varName] = {
        value: variable.default || '',
        source: 'default',
        variable,
      };
      continue;
    }

    // Interactive prompt
    const value = await promptVariable(varName, variable);
    collected[varName] = {
      value,
      source: 'prompt',
      variable,
    };
  }

  return collected;
}

/**
 * Prompt for a single variable value
 */
async function promptVariable(name: string, variable: Variable): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const defaultHint = variable.default ? ` (default: ${variable.default})` : '';
    const typeHint = variable.type === 'secret' ? ' [hidden]' : '';
    const prompt = `\n${variable.description}${typeHint}${defaultHint}\n${name}: `;

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || variable.default || '');
    });
  });
}

/**
 * Export variables to environment format for shell scripts
 */
export function variablesToEnv(
  variables: CollectedVariables,
  stepId: string
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [name, { value }] of Object.entries(variables)) {
    // Set both plain name and prefixed name
    env[name] = value;
    env[`BOOTI_${stepId.toUpperCase().replace(/-/g, '_')}__${name}`] = value;
  }

  return env;
}
