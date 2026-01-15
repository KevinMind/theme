import { spawn } from 'bun';
import { writeText, ensureParentDir } from './fs';
import { generateShellPreamble } from '../core/shell-helpers';

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a shell script with the Booti helpers injected
 */
export async function runScript(
  scriptPath: string,
  options: {
    dryRun: boolean;
    env: Record<string, string>;
    cwd?: string;
  }
): Promise<SpawnResult> {
  const { dryRun, env, cwd } = options;

  // Read the original script
  const { readText } = await import('./fs');
  const originalScript = await readText(scriptPath);

  // Generate the full script with preamble
  const preamble = generateShellPreamble(dryRun, env);
  const fullScript = preamble + originalScript;

  // Write to a temp file
  const tmpScript = `/tmp/booti-script-${Date.now()}.sh`;
  await ensureParentDir(tmpScript);
  await writeText(tmpScript, fullScript);

  // Make executable
  const { chmod } = await import('fs/promises');
  await chmod(tmpScript, 0o755);

  // Execute the script
  const proc = spawn({
    cmd: ['bash', tmpScript],
    cwd: cwd || process.cwd(),
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  // Cleanup temp file
  const { unlink } = await import('fs/promises');
  await unlink(tmpScript).catch(() => {});

  return { exitCode, stdout, stderr };
}

/**
 * Execute a simple bash command
 */
export async function runCommand(
  command: string,
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {}
): Promise<SpawnResult> {
  const { cwd, env = {} } = options;

  const proc = spawn({
    cmd: ['bash', '-c', command],
    cwd: cwd || process.cwd(),
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}
