# Plug In Your Agent

The AI Agent Eval Harness is designed to work with any browser-based agent. This guide shows you how to integrate your own.

## Architecture

The harness uses a **pluggable agent adapter** pattern:

```typescript
export type AgentAdapter = (ctx: RunContext, task: string) => Promise<void>;
```

An agent receives:
- `ctx`: RunContext with `page` (Playwright Page), `transcript` (log array)
- `task`: string description of what to accomplish

Your agent performs browser interactions and updates `ctx.transcript` with what happened.

## Default: Scripted Agent

The repo ships with a **scripted agent** (`src/agent/scripted.ts`) — deterministic, no API key, reproducible. This proves the harness works on a clean clone.

Run eval with scripted agent (default):
```bash
npm run eval
```

Results: 9 reliable cases (100%), 1 flaky (80% from mock-site bug).

## Adding Your Agent

### 1. Create Your Adapter

Create `src/agent/my-agent.ts`:

```typescript
import type { RunContext } from '../types.js';

export async function myAgent(ctx: RunContext, task: string): Promise<void> {
  const { page, transcript } = ctx;

  // Your agent logic here
  // Example: use Stagehand, Claude API, Anthropic's Computer Use, etc.
  
  await page.goto('https://your-staging.example.com');
  // ... interact with page ...
  
  transcript.push('Agent actions: searched for flights, selected cheapest, paid');
}
```

### 2. Register in Agent Selector

Edit `src/agent/index.ts` to add your agent:

```typescript
import { myAgent } from './my-agent.js';

export function selectAgent(): AgentAdapter {
  const agentType = process.env.AGENT || 'scripted';
  
  switch (agentType) {
    case 'my-agent':
      return myAgent;
    case 'stagehand':
      return stagehand;
    default:
      return scripted;
  }
}
```

### 3. Run Eval with Your Agent

```bash
AGENT=my-agent npm run eval
```

## Example: Stagehand Agent

Stagehand is an LLM-driven agent from Browserbase. The harness includes a stagehand adapter:

```bash
OPENAI_API_KEY=sk-... AGENT=stagehand npm run eval
```

The stagehand adapter is in `src/agent/stagehand.ts` — adapt it for your LLM provider.

## Testing Against Your Site

### 1. Update BASE_URL

If your site is not at `http://localhost:3000`, update `evals/cases/*.ts`:

```typescript
setup: async (ctx) => {
  await ctx.page.goto('https://your-app.staging.example.com');
  ctx.transcript.push('Navigated to booking site');
},
```

### 2. Create Test Cases

Add cases in `evals/cases/` that match your app. Each case is an `EvalCase`:

```typescript
export interface EvalCase {
  id: string;              // Unique identifier
  title: string;           // Display name
  description: string;     // What this tests
  task: string;            // What the agent should do
  setup: async (ctx) => {  // Pre-test setup (navigate, etc.)
    // ...
  };
  assertions: EvalAssertion[];  // What defines "passed"
}
```

### 3. Run Against Your Agent

```bash
AGENT=my-agent npm run eval
```

## Assertion Types

Use these to define what passes:

- **DOM assertions**: Check page elements
  ```typescript
  { kind: 'dom', locator: '[data-testid="confirmation"]', expect: 'present', timeoutMs: 5000 }
  ```

- **State assertions**: Check backend via API
  ```typescript
  {
    kind: 'state',
    name: 'order-created',
    check: async (ctx) => {
      const orders = await ctx.page.evaluate(() =>
        fetch('/api/orders').then(r => r.json())
      );
      return orders.length > 0;
    }
  }
  ```

- **Judge assertions**: LLM-based assertions (optional, currently stubbed)
  ```typescript
  { kind: 'judge', prompt: 'Did the agent select the cheapest flight?' }
  ```

## Output

After a run, you get:

- `evals/report.json` — Results for this run
- `evals/baseline.json` — Known-good baseline (for regression detection)
- `evals/traces/` — Playwright traces for debugging

## CI/CD Integration

The `.github/workflows/eval.yml` workflow runs eval on every push.

To update the baseline in CI:
```bash
npm run eval -- --update-baseline
```

This only runs if you explicitly request it, preventing silent regressions.

## Troubleshooting

**Agent runs but no assertions pass**
- Check `ctx.transcript` in report.json — does it show your agent's actions?
- Add console.log to your agent and read Playwright traces in `evals/traces/`

**Test is flaky**
- Increase timeout: `await page.waitForSelector('...', { timeout: 10000 })`
- Use Pass@K: if pass rate is >50%, your harness is working

**Baseline gate doesn't trigger**
- Ensure `evals/baseline.json` exists and is committed to git
- Run `npm run eval` to generate a fresh baseline after agent changes

## Questions?

This harness is designed for browser agents. If your agent can't accept a Playwright page:
- Use a bridge: your agent opens its own browser, your adapter screenshots/OCR the state
- Adapt the runner to work with your agent's API
- Open an issue on GitHub

Good luck! 🚀
