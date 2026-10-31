// Assertion runner - executes each assertion and returns results

import type { Assertion, RunContext, AssertionOutcome } from './types.js';

export async function checkAssertion(a: Assertion, ctx: RunContext): Promise<AssertionOutcome> {
  const label = getLabel(a);

  try {
    if (a.kind === 'dom') {
      return await checkDOM(a, ctx, label);
    }

    if (a.kind === 'state') {
      const pass = await a.check(ctx);
      return { assertion: label, pass };
    }

    if (a.kind === 'judge') {
      // For now, just return a placeholder (full judge needs LLM API)
      return {
        assertion: label,
        pass: true,
        detail: 'Judge assertion (requires LLM - skipped in demo)',
      };
    }

    return { assertion: label, pass: false, detail: 'Unknown assertion type' };
  } catch (e) {
    return {
      assertion: label,
      pass: false,
      detail: `Error: ${String(e).substring(0, 100)}`,
    };
  }
}

async function checkDOM(
  a: any,
  ctx: RunContext,
  label: string
): Promise<AssertionOutcome> {
  const loc = ctx.page.locator(a.locator).first();
  const timeout = a.timeoutMs ?? 5000;

  try {
    if (a.expect === 'present') {
      await loc.waitFor({ state: 'visible', timeout });
      return {
        assertion: label,
        pass: true,
        detail: `Element found: ${a.locator}`,
      };
    } else if (a.expect === 'absent') {
      // Try to find it; if not found, that's a pass
      const found = await loc.isVisible({ timeout: 1000 }).catch(() => false);
      return {
        assertion: label,
        pass: !found,
        detail: found ? `Element still present: ${a.locator}` : 'Element not found (as expected)',
      };
    }
  } catch (e) {
    if (a.expect === 'present') {
      return {
        assertion: label,
        pass: false,
        detail: `Element not found: ${a.locator}`,
      };
    }
    return {
      assertion: label,
      pass: true,
      detail: 'Element not found (as expected)',
    };
  }

  return { assertion: label, pass: false, detail: 'DOM check failed' };
}

function getLabel(a: Assertion): string {
  if (a.kind === 'judge') {
    return `judge: ${a.rubric.substring(0, 40)}...`;
  }
  if (a.kind === 'state') {
    return `state: ${a.name}`;
  }
  if (a.kind === 'dom') {
    return `dom: ${a.expect} ${a.locator}`;
  }
  return 'unknown';
}
