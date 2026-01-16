import { spawn } from 'bun';

/**
 * Execute a command and return the result
 */
export interface ExecResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Options for executing commands
 */
interface ExecOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

/**
 * Execute a shell command
 */
export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  try {
    const proc = spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: options.cwd,
      env: options.env,
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return {
      success: exitCode === 0,
      exitCode,
      stdout,
      stderr,
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute a shell command with output streaming and interactive input
 */
export async function execWithOutput(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  try {
    const proc = spawn([command, ...args], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      cwd: options.cwd,
      env: options.env,
    });

    const exitCode = await proc.exited;

    return {
      success: exitCode === 0,
      exitCode,
      stdout: '',
      stderr: '',
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if a command exists
 */
export async function commandExists(command: string): Promise<boolean> {
  const result = await exec('which', [command]);
  return result.success;
}
