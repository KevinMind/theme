import type { DiscoveredStep, DependencyGraph } from '../types';

/**
 * Build a dependency graph and perform topological sort
 */
export function buildDependencyGraph(
  steps: DiscoveredStep[],
  selectedSteps?: string[]
): DependencyGraph {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const dependents = new Map<string, string[]>();
  const autoIncluded: string[] = [];

  // Initialize dependents map
  for (const step of steps) {
    dependents.set(step.id, []);
  }

  // Build reverse dependency map
  for (const step of steps) {
    for (const dep of step.config.dependencies) {
      const depList = dependents.get(dep);
      if (depList) {
        depList.push(step.id);
      }
    }
  }

  // If specific steps are selected, include their dependencies
  let stepsToProcess = selectedSteps
    ? new Set(selectedSteps)
    : new Set(steps.map(s => s.id));

  if (selectedSteps) {
    // Add all dependencies recursively
    const addDependencies = (stepId: string) => {
      const step = stepMap.get(stepId);
      if (!step) return;

      for (const dep of step.config.dependencies) {
        if (!stepsToProcess.has(dep)) {
          stepsToProcess.add(dep);
          autoIncluded.push(dep);
          addDependencies(dep);
        }
      }
    };

    for (const stepId of selectedSteps) {
      addDependencies(stepId);
    }
  }

  // Perform topological sort
  const order = topologicalSort(steps, stepsToProcess);

  return { order, dependents, autoIncluded };
}

/**
 * Topological sort using DFS
 */
export function topologicalSort(
  steps: DiscoveredStep[],
  includeSteps?: Set<string>
): string[] {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  const visit = (stepId: string) => {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) {
      throw new Error(`Circular dependency detected involving: ${stepId}`);
    }

    const step = stepMap.get(stepId);
    if (!step) return;

    // Skip if not in the include set (when filtering)
    if (includeSteps && !includeSteps.has(stepId)) return;

    visiting.add(stepId);

    // Visit dependencies first
    for (const dep of step.config.dependencies) {
      visit(dep);
    }

    visiting.delete(stepId);
    visited.add(stepId);
    result.push(stepId);
  };

  // Visit all steps
  const stepsToVisit = includeSteps
    ? Array.from(includeSteps)
    : steps.map(s => s.id);

  for (const stepId of stepsToVisit) {
    visit(stepId);
  }

  return result;
}

/**
 * Validate that there are no circular dependencies
 */
export function validateNoCycles(steps: DiscoveredStep[]): void {
  topologicalSort(steps); // Will throw if cycles exist
}

/**
 * Get a step by ID from the list
 */
export function getStepById(
  steps: DiscoveredStep[],
  id: string
): DiscoveredStep | undefined {
  return steps.find(s => s.id === id);
}
