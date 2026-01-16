import { homedir } from 'os';
import { join } from 'path';
import type { DiscoveredStep, VariableMatch, ExtractedValue } from '../types';
import type { Variable } from '../schemas/step';
import { readText, fileExists } from '../utils/fs';

/**
 * Find all ${VAR_NAME} patterns in content
 * Returns matches in order of appearance
 */
export function findVariablesInTemplate(content: string): VariableMatch[] {
  const matches: VariableMatch[] = [];
  const regex = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    matches.push({
      name: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build regex from template for value extraction
 * Converts template with ${VAR} placeholders to a regex with capture groups
 */
export function buildExtractionRegex(
  template: string
): { regex: RegExp; varNames: string[] } | null {
  const matches = findVariablesInTemplate(template);
  if (matches.length === 0) {
    return null;
  }

  const varNames: string[] = [];
  let regexStr = '';
  let lastIndex = 0;

  for (const match of matches) {
    // Add escaped literal text before this variable
    const literalPart = template.slice(lastIndex, match.startIndex);
    regexStr += escapeRegex(literalPart);

    // Add capture group for variable (non-greedy match)
    regexStr += '(.+?)';
    varNames.push(match.name);

    lastIndex = match.endIndex;
  }

  // Add remaining literal text after last variable
  const remaining = template.slice(lastIndex);
  regexStr += escapeRegex(remaining);

  try {
    // Use 's' flag for dotall mode (. matches newlines)
    const regex = new RegExp(`^${regexStr}$`, 's');
    return { regex, varNames };
  } catch {
    return null;
  }
}

/**
 * Substitute built-in variables (HOME, USER) in content
 */
export function substituteBuiltins(content: string): string {
  return content
    .replace(/\$\{HOME\}/g, homedir())
    .replace(/\$\{USER\}/g, process.env.USER || '');
}

/**
 * Extract values using replace strategy
 * Matches template pattern against local content to extract variable values
 */
export function extractValuesFromText(
  template: string,
  local: string
): Map<string, string> {
  const values = new Map<string, string>();

  // Substitute built-ins in template first
  const templateWithBuiltins = substituteBuiltins(template);

  const result = buildExtractionRegex(templateWithBuiltins);
  if (!result) {
    return values;
  }

  const { regex, varNames } = result;
  const match = regex.exec(local);

  if (match) {
    for (let i = 0; i < varNames.length; i++) {
      const value = match[i + 1];
      if (value !== undefined) {
        values.set(varNames[i], value);
      }
    }
  }

  return values;
}

/**
 * Get value at a JSON path (e.g., ".mcpServers.myServer.token")
 */
function getValueAtPath(obj: unknown, jqPath: string): unknown {
  const parts = jqPath.split('.').filter(p => p.length > 0);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Find all variable placeholders in a value and return their paths
 */
function findVariablesInValue(
  value: unknown,
  currentPath: string[] = []
): Array<{ path: string[]; varName: string }> {
  const results: Array<{ path: string[]; varName: string }> = [];

  if (typeof value === 'string') {
    const matches = findVariablesInTemplate(value);
    for (const match of matches) {
      results.push({ path: currentPath, varName: match.name });
    }
  } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      results.push(...findVariablesInValue(val, [...currentPath, key]));
    }
  }

  return results;
}

/**
 * Extract values using jq-merge strategy
 * Finds variable placeholders in template JSON and extracts corresponding values from local JSON
 */
export function extractValuesFromJson(
  templateJson: Record<string, unknown>,
  localJson: Record<string, unknown>,
  jqPath: string
): Map<string, string> {
  const values = new Map<string, string>();

  // Get the subset at jqPath from both template and local
  const templateSubset = getValueAtPath(templateJson, jqPath);
  const localSubset = getValueAtPath(localJson, jqPath);

  if (!templateSubset || typeof templateSubset !== 'object') {
    return values;
  }

  // Find all variables in the template subset
  const varLocations = findVariablesInValue(templateSubset);

  for (const { path, varName } of varLocations) {
    // Get the corresponding value from local at the same path
    let localValue = localSubset;
    for (const part of path) {
      if (localValue === null || localValue === undefined || typeof localValue !== 'object') {
        localValue = undefined;
        break;
      }
      localValue = (localValue as Record<string, unknown>)[part];
    }

    if (typeof localValue === 'string') {
      values.set(varName, localValue);
    }
  }

  return values;
}

/**
 * Extract variable values from existing local files
 * Used for smart prompting to show current values
 */
export async function extractVariablesFromExistingFiles(
  steps: DiscoveredStep[],
  variableDefs: Map<string, { variable: Variable; usedBy: string[] }>,
  homeDir: string
): Promise<Map<string, ExtractedValue>> {
  const extracted = new Map<string, ExtractedValue>();
  const stepMap = new Map(steps.map(s => [s.id, s]));

  // Build a map of which variables appear in which files
  const variableToFiles = new Map<
    string,
    Array<{ step: DiscoveredStep; filePath: string; strategy: string; jqPath?: string }>
  >();

  for (const step of steps) {
    if (!step.templateDir) continue;

    for (const file of step.config.files) {
      const templatePath = join(step.templateDir, file.path);

      try {
        const templateContent = await readText(templatePath);
        const varsInTemplate = findVariablesInTemplate(templateContent);

        for (const varMatch of varsInTemplate) {
          if (!variableToFiles.has(varMatch.name)) {
            variableToFiles.set(varMatch.name, []);
          }
          variableToFiles.get(varMatch.name)!.push({
            step,
            filePath: file.path,
            strategy: file.strategy,
            jqPath: file.jq_path,
          });
        }
      } catch {
        // Template file not readable, skip
      }
    }
  }

  // For each variable, try to extract from the first available local file
  for (const [varName, { variable }] of variableDefs) {
    const fileInfos = variableToFiles.get(varName);
    if (!fileInfos || fileInfos.length === 0) continue;

    for (const { step, filePath, strategy, jqPath } of fileInfos) {
      const localPath = join(homeDir, filePath);
      const templatePath = join(step.templateDir!, filePath);

      if (!(await fileExists(localPath))) continue;

      try {
        const localContent = await readText(localPath);
        const templateContent = await readText(templatePath);

        let extractedValues: Map<string, string>;

        if (strategy === 'jq-merge' && jqPath) {
          const localJson = JSON.parse(localContent);
          const templateJson = JSON.parse(templateContent);
          extractedValues = extractValuesFromJson(templateJson, localJson, jqPath);
        } else {
          extractedValues = extractValuesFromText(templateContent, localContent);
        }

        const value = extractedValues.get(varName);
        if (value !== undefined) {
          extracted.set(varName, {
            value,
            source: localPath,
            isSecret: variable.type === 'secret',
          });
          break; // Found value, no need to check other files
        }
      } catch {
        // Extraction failed for this file, try next
      }
    }
  }

  return extracted;
}
