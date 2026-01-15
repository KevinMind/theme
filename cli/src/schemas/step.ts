import { z } from 'zod';

export const VariableSchema = z.object({
  type: z.enum(['string', 'boolean', 'secret']).default('string'),
  description: z.string(),
  default: z.string().optional(),
  required: z.boolean().default(true),
});

export const FileConfigSchema = z.object({
  path: z.string(),
  strategy: z.enum(['replace', 'jq-merge']),
  jq_path: z.string().optional(),
  description: z.string().optional(),
});

export const StepSchema = z.object({
  name: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()).default([]),
  variables: z.record(z.string(), VariableSchema).default({}),
  files: z.array(FileConfigSchema).default([]),
  platforms: z.array(z.enum(['darwin', 'linux', 'win32'])).default(['darwin']),
  condition: z.string().optional(),
});

export type Variable = z.infer<typeof VariableSchema>;
export type FileConfig = z.infer<typeof FileConfigSchema>;
export type Step = z.infer<typeof StepSchema>;
