import type { Step, Variable, FileConfig } from '../schemas/step';

export interface DiscoveredStep {
  /** Directory name (e.g., "homebrew") */
  id: string;
  /** Parsed step.json configuration */
  config: Step;
  /** Full path to step directory */
  directory: string;
  /** Whether the step has a pre.sh script */
  hasPreScript: boolean;
  /** Whether the step has a post.sh script */
  hasPostScript: boolean;
  /** Full path to templates directory, or null if none */
  templateDir: string | null;
}

export interface DependencyGraph {
  /** Topologically sorted step IDs */
  order: string[];
  /** For each step, which steps depend on it */
  dependents: Map<string, string[]>;
  /** Steps that were auto-included as dependencies */
  autoIncluded: string[];
}

export interface CollectedVariables {
  [key: string]: {
    value: string;
    source: string;
    variable: Variable;
  };
}

export interface ExecutionContext {
  dryRun: boolean;
  noInput: boolean;
  variables: CollectedVariables;
  homeDir: string;
  selectedSteps?: string[];
}

export interface ExecutionResult {
  step: string;
  success: boolean;
  error?: Error;
  skipped?: boolean;
  skipReason?: string;
}

export interface SyncOptions {
  dryRun: boolean;
  variables: CollectedVariables;
  homeDir: string;
}

export interface CliOptions {
  dryRun: boolean;
  noInput: boolean;
  steps?: string[];
  list: boolean;
  verbose: boolean;
  quiet: boolean;
  gitName?: string;
  gitEmail?: string;
  gtToken?: string;
  githubToken?: string;
}

export type { Step, Variable, FileConfig };
