import type { RunContext } from '../types.js';
import * as Stagehand from '@browserbasehq/stagehand';

/**
 * Stagehand agent: real LLM-driven browser automation.
 * Requires OPENAI_API_KEY or appropriate LLM key.
 * Enable with: AGENT=stagehand npm run eval
 */
export async function stagehand(ctx: RunContext, task: string): Promise<void> {
  const { page } = ctx;

  try {
    const sh = new (Stagehand as any).default({
      env: 'LOCAL',
      page,
      apiKey: process.env.OPENAI_API_KEY,
    });

    await sh.init();
    const result = await sh.act({ action: task });
    ctx.transcript.push(result.toString());
    await sh.close();
  } catch (error) {
    ctx.transcript.push(`Stagehand failed: ${error}`);
    throw error;
  }
}
