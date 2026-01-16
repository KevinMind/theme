import { join } from 'path';
import type { DiscoveredStep, BackupResult, BackupSummary, BackupOptions } from '../types';
import type { FileConfig } from '../schemas/step';
import { readText, writeText, fileExists, readJson, writeJson } from '../utils/fs';
import {
  findVariablesInTemplate,
  extractValuesFromText,
  extractValuesFromJson,
  substituteBuiltins,
} from './extraction';
import { logger } from './logger';

/**
 * Replace extracted values in content with ${VAR_NAME} placeholders
 */
function replaceValuesWithPlaceholders(
  content: string,
  values: Map<string, string>
): string {
  let result = content;

  // Sort by value length descending to replace longer values first
  // This prevents partial replacement issues
  const sortedEntries = Array.from(values.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  for (const [varName, value] of sortedEntries) {
    if (value.length > 0) {
      // Escape special regex chars in value
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedValue, 'g');
      result = result.replace(regex, `\${${varName}}`);
    }
  }

  return result;
}

/**
 * Replace values with placeholders in JSON at a specific path
 */
function replaceJsonValuesWithPlaceholders(
  json: Record<string, unknown>,
  values: Map<string, string>,
  jqPath: string
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(json)); // Deep clone

  // Parse the jqPath
  const pathParts = jqPath.split('.').filter(p => p.length > 0);

  // Navigate to the target location
  let current: Record<string, unknown> = result;
  for (const part of pathParts) {
    if (!current[part] || typeof current[part] !== 'object') {
      return result; // Path doesn't exist, return unchanged
    }
    current = current[part] as Record<string, unknown>;
  }

  // Recursively replace string values
  function replaceInObject(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        for (const [varName, varValue] of values) {
          if (value === varValue) {
            obj[key] = `\${${varName}}`;
            break;
          }
        }
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        replaceInObject(value as Record<string, unknown>);
      }
    }
  }

  replaceInObject(current);
  return result;
}

/**
 * Backup a single file - extract values from local and update template
 */
export async function backupFile(
  file: FileConfig,
  templateDir: string,
  homeDir: string,
  dryRun: boolean
): Promise<BackupResult> {
  const localPath = join(homeDir, file.path);
  const templatePath = join(templateDir, file.path);

  // Check if local file exists
  if (!(await fileExists(localPath))) {
    return {
      path: file.path,
      changed: false,
      error: 'Local file does not exist',
    };
  }

  // Check if template file exists
  if (!(await fileExists(templatePath))) {
    return {
      path: file.path,
      changed: false,
      error: 'Template file does not exist',
    };
  }

  try {
    const localContent = await readText(localPath);
    const templateContent = await readText(templatePath);

    let newTemplateContent: string;

    if (file.strategy === 'jq-merge' && file.jq_path) {
      // JSON merge strategy
      const localJson = JSON.parse(localContent) as Record<string, unknown>;
      const templateJson = JSON.parse(templateContent) as Record<string, unknown>;

      // Extract values from local
      const values = extractValuesFromJson(templateJson, localJson, file.jq_path);

      if (values.size === 0) {
        return {
          path: file.path,
          changed: false,
        };
      }

      // Get the subset from local at the jq_path
      const pathParts = file.jq_path.split('.').filter(p => p.length > 0);
      let localSubset: unknown = localJson;
      for (const part of pathParts) {
        if (localSubset && typeof localSubset === 'object') {
          localSubset = (localSubset as Record<string, unknown>)[part];
        }
      }

      if (!localSubset || typeof localSubset !== 'object') {
        return {
          path: file.path,
          changed: false,
          error: 'Cannot find jq_path in local file',
        };
      }

      // Replace values with placeholders in the local subset
      const updatedSubset = replaceJsonValuesWithPlaceholders(
        localSubset as Record<string, unknown>,
        values,
        '.' // Root of the subset
      );

      // Update the template with the new subset
      const updatedTemplate = JSON.parse(JSON.stringify(templateJson));
      let current: Record<string, unknown> = updatedTemplate;
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]] as Record<string, unknown>;
      }
      if (pathParts.length > 0) {
        current[pathParts[pathParts.length - 1]] = updatedSubset;
      }

      newTemplateContent = JSON.stringify(updatedTemplate, null, 2) + '\n';
    } else {
      // Replace strategy
      const templateWithBuiltins = substituteBuiltins(templateContent);
      const values = extractValuesFromText(templateContent, localContent);

      if (values.size === 0) {
        // No variables found or extraction failed
        // Check if local differs from template (with builtins substituted)
        if (localContent === templateWithBuiltins) {
          return {
            path: file.path,
            changed: false,
          };
        }
        // Files differ but no variables to extract - could be manual changes
        // In this case, we can't safely re-create placeholders
        return {
          path: file.path,
          changed: false,
          error: 'Structure mismatch - cannot extract variables',
        };
      }

      // Replace actual values with placeholders
      newTemplateContent = replaceValuesWithPlaceholders(localContent, values);
    }

    // Check if template would actually change
    if (newTemplateContent === templateContent) {
      return {
        path: file.path,
        changed: false,
      };
    }

    if (dryRun) {
      logger.dryRun(`Would update template: ${templatePath}`);
    } else {
      await writeText(templatePath, newTemplateContent);
      logger.success(`Updated template: ${templatePath}`);
    }

    return {
      path: file.path,
      changed: true,
    };
  } catch (error) {
    return {
      path: file.path,
      changed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run backup across all steps
 */
export async function runBackup(
  steps: DiscoveredStep[],
  options: BackupOptions
): Promise<BackupSummary> {
  const summary: BackupSummary = {
    filesUpdated: 0,
    filesSkipped: 0,
    errors: [],
  };

  for (const step of steps) {
    if (!step.templateDir) continue;

    logger.info(`Processing step: ${step.id}`);

    for (const file of step.config.files) {
      const result = await backupFile(
        file,
        step.templateDir,
        options.homeDir,
        options.dryRun
      );

      if (result.error) {
        if (result.error === 'Local file does not exist') {
          logger.debug(`  Skipped ${file.path}: ${result.error}`);
        } else {
          logger.warning(`  ${file.path}: ${result.error}`);
          summary.errors.push(`${file.path}: ${result.error}`);
        }
        summary.filesSkipped++;
      } else if (result.changed) {
        summary.filesUpdated++;
      } else {
        logger.debug(`  Skipped ${file.path}: no changes`);
        summary.filesSkipped++;
      }
    }
  }

  return summary;
}
