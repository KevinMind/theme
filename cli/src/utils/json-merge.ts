import { readJson, writeJson, fileExists } from './fs';

/**
 * Deep merge two objects
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      // Overwrite with source value
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Deep merge at a specific JSON path
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @param jqPath - JSON path like "." (root) or ".mcpServers"
 */
export function deepMergeAtPath(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  jqPath: string
): Record<string, unknown> {
  // Parse jq path (e.g., ".mcpServers" -> ["mcpServers"])
  const pathParts = jqPath
    .split('.')
    .filter(p => p.length > 0);

  // Root merge
  if (pathParts.length === 0) {
    return deepMerge(target, source);
  }

  // Navigate to the target location and merge
  const result = { ...target };
  let current: Record<string, unknown> = result;

  // Navigate to parent of target path
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  // Merge at the final path
  const finalKey = pathParts[pathParts.length - 1];
  const targetAtPath = (current[finalKey] || {}) as Record<string, unknown>;
  current[finalKey] = deepMerge(targetAtPath, source);

  return result;
}

/**
 * Merge source JSON content into a target file at a specific path
 */
export async function jqMerge(
  targetPath: string,
  sourceContent: string,
  jqPath: string
): Promise<void> {
  // Parse source content
  const source = JSON.parse(sourceContent) as Record<string, unknown>;

  // Read target file or start with empty object
  let target: Record<string, unknown> = {};
  if (await fileExists(targetPath)) {
    try {
      target = await readJson<Record<string, unknown>>(targetPath);
    } catch (error) {
      // If target is corrupt, back it up and start fresh
      const { copyFile } = await import('fs/promises');
      await copyFile(targetPath, `${targetPath}.corrupt.bak`);
      target = {};
    }
  }

  // Merge and write
  const merged = deepMergeAtPath(target, source, jqPath);
  await writeJson(targetPath, merged);
}
