import { access, mkdir, readFile, writeFile, copyFile, stat } from 'fs/promises';
import { dirname } from 'path';

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if path is a file (not directory)
 */
export async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Check if path is a directory
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists, creating it recursively if needed
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Ensure parent directory of a file path exists
 */
export async function ensureParentDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await ensureDir(dir);
}

/**
 * Read file contents as string
 */
export async function readText(path: string): Promise<string> {
  return await readFile(path, 'utf-8');
}

/**
 * Write string to file, creating parent directories if needed
 */
export async function writeText(path: string, content: string): Promise<void> {
  await ensureParentDir(path);
  await writeFile(path, content, 'utf-8');
}

/**
 * Read and parse JSON file
 */
export async function readJson<T = unknown>(path: string): Promise<T> {
  const content = await readText(path);
  return JSON.parse(content) as T;
}

/**
 * Write JSON to file with pretty formatting
 */
export async function writeJson(path: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n';
  await writeText(path, content);
}

/**
 * Copy file with backup of existing file
 */
export async function copyWithBackup(
  source: string,
  dest: string,
  backupSuffix = '.bak'
): Promise<void> {
  await ensureParentDir(dest);

  // Backup existing file if it exists
  if (await isFile(dest)) {
    await copyFile(dest, `${dest}${backupSuffix}`);
  }

  await copyFile(source, dest);
}
