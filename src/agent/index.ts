import type { RunContext } from '../types.js';
import { scripted } from './scripted.js';
import { stagehand } from './stagehand.js';

export type AgentAdapter = (ctx: RunContext, task: string) => Promise<void>;

/**
 * Select the agent to run based on environment variable.
 * AGENT=stagehand uses real LLM, otherwise defaults to deterministic scripted agent.
 */
export function selectAgent(): AgentAdapter {
  const agent = process.env.AGENT || 'scripted';
  
  if (agent === 'stagehand') {
    return stagehand;
  }
  
  return scripted;
}
