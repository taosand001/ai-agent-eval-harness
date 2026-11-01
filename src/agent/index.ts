import type { RunContext } from '../types.js';

export type AgentAdapter = (ctx: RunContext, task: string) => Promise<void>;

/**
 * Select the agent to run based on environment variable.
 * Default: deterministic scripted agent (no deps, no API keys).
 * AGENT=stagehand: lazy-loads real LLM agent (optional, requires API key).
 */
export async function selectAgent(): Promise<AgentAdapter> {
  const agent = process.env.AGENT || 'scripted';
  
  if (agent === 'stagehand') {
    const { stagehand } = await import('./stagehand.js');
    return stagehand;
  }
  
  const { scripted } = await import('./scripted.js');
  return scripted;
}
