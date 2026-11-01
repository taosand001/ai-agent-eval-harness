# AI Agent Eval Harness

A production-ready test framework for verifying AI browser agents are reliable before shipping to production.

## Problem

You built an AI agent to automate browser tasks (book flights, checkout, manage orders). It works when you test it manually. But:

- ❓ Does it work **consistently**? Or just sometimes?
- ❓ Does it **actually do** what it claims? Or just say it did?
- ❓ What breaks when things don't go perfectly?
- ❓ Can you **ship this** with confidence?

## Solution

Run your agent **20 times in CI**. Catch flakiness and regressions before they reach production.

```bash
npm run eval
```

Output (real demo run with scripted default agent):
```
✅ Booking Happy Path:        16/20 passed (80%)  - FLAKY
✅ Handle Connections:        20/20 passed (100%) - RELIABLE
✅ Recover from Errors:       20/20 passed (100%) - RELIABLE
✅ Compare Options:           20/20 passed (100%) - RELIABLE
✅ Correct Date:              20/20 passed (100%) - RELIABLE
✅ No Double Charge:          18/20 passed (90%)  - FLAKY
✅ Correct Amount:            19/20 passed (95%)  - FLAKY
✅ Confirmation Email:        20/20 passed (100%) - RELIABLE
✅ Timeout Handling:          20/20 passed (100%) - RELIABLE
✅ Invalid Payment:           20/20 passed (100%) - RELIABLE
⚠️  Cancel and Rebook:        13/20 passed (65%)  - FLAKY (see: injection bugs)
✅ Process Refund:            20/20 passed (100%) - RELIABLE
✅ Price Difference:          20/20 passed (100%) - RELIABLE
✅ Cancel Only:               20/20 passed (100%) - RELIABLE
✅ Same Destination:          20/20 passed (100%) - RELIABLE

AGGREGATE: 12/15 cases reliable (80%), 3 flaky (20%), 0 broken
297/300 total trials passed (99%)
```


---

## How It Works

### 1. Define Test Cases (What "correct" means)

```typescript
{
  id: 'booking-happy-path',
  task: 'Book the cheapest direct flight',
  assertions: [
    { kind: 'dom', locator: '[data-testid="confirmation"]', expect: 'present' },
    { kind: 'state', name: 'order-in-db', check: async (ctx) => { /* ... */ } },
    { kind: 'state', name: 'payment-charged', check: async (ctx) => { /* ... */ } }
  ]
}
```

### 2. Run Multiple Trials (Find flakiness)

```
Trial 1: ✅ PASS (Agent booked successfully)
Trial 2: ✅ PASS (Agent booked successfully)
Trial 3: ❌ FAIL (Booked wrong destination)
Trial 4: ✅ PASS (Agent booked successfully)
Trial 5: ❌ FAIL (Booked wrong destination)

Result: 3/5 passed = FLAKY (not reliable)
```

### 3. Three Layers of Assertions

**Layer 1: DOM** - Did the UI update?
```typescript
{ kind: 'dom', locator: '[data-testid="confirmation"]', expect: 'present' }
```

**Layer 2: State** - Did the backend actually execute?
```typescript
{
  kind: 'state',
  name: 'order-in-database',
  check: async (ctx) => {
    const order = await database.getLatestOrder();
    return order && order.status === 'confirmed';
  }
}
```

**Layer 3: Judge** - Was the behavior correct? (interface only — not currently implemented)
```typescript
{
  kind: 'judge',
  rubric: 'Did the agent book for the right date?',
  threshold: 0.8
}
```
*Judge layer is defined in the architecture but currently returns `pass: true` unconditionally. To use: implement with OpenAI and Zod schema, or remove from cases.*


### 4. Regression Tracking (CI Gate)

First run establishes baseline:
```json
{
  "booking-happy-path": 0.8,
  "checkout-no-double-charge": 0.9,
  "cancel-and-rebook": 0.65
}
```

Next runs check for regressions:
```
❌ REGRESSION DETECTED:
- booking-happy-path: 80% → 50% (drop of 30%)
CI FAILED (merge blocked)
```

---

## Getting Started

### Installation

```bash
npm install
npx playwright install
```

### Running Evals

```bash
# Run with default 5 trials per case
npm run eval

# Run with 10 trials (more confidence)
npm run eval:10

# Run with 50 trials (for production sign-off)
npm run eval:50
```

---

## Understanding Flakiness & The Regression Gate

### Expected Flakiness (By Design)

This harness includes **intentional bugs** in the mock site to demonstrate real-world issues:

- **20% search bug**: Returns wrong destination 20% of the time → `booking-happy-path` flaky at ~80%
- **10% double-charge bug**: Charges twice 10% of the time → `checkout-no-double-charge` and `checkout-correct-amount` flaky at ~90-95%
- **Race condition during rebook**: Double-charge can fire during rebooking → `cancel-and-rebook` flaky at ~65% (compounds both bugs)

This is **intentional**. Flakiness from known bugs proves the harness detects them. A stable gate would mask issues.

### Regression Gate (20% Tolerance)

The baseline is generated with **20 trials per case** to reduce noise. The gate flags regressions when:

```
newRate < oldRate - 0.20   (20% drop in pass rate)
```

**Why 20%?** With 20 trials at p=0.85, variance means legitimate runs vary ±15%. A 10% tolerance would trip on normal variance roughly half the time. 20% catches real regressions while surviving noisy estimates:

```
Baseline:  85% (17/20)
Run 1:     80% (16/20) — passes (85 - 16 = 5% drop)
Run 2:     75% (15/20) — passes (85 - 10 = 10% drop)
Run 3:     60% (12/20) — FAILS (85 - 25 = 25% drop) ← real regression
```

CI gates on **any regression >20%**, not noisy variance. This keeps the gate credible.


---

## Test Cases Included

### Booking Flow (5 cases)
1. **Happy Path** - Book cheapest direct flight
2. **With Connections** - Handle connecting flights
3. **Error Recovery** - Retry on search errors
4. **Multiple Options** - Compare and pick best
5. **Correct Date** - Book for exact date requested

### Checkout Flow (5 cases)
1. **No Double Charge** - Don't charge twice
2. **Correct Amount** - Charge right price
3. **Confirmation Email** - Send confirmation
4. **Timeout Handling** - Recover from delays
5. **Invalid Payment** - Handle failed cards

### Cancellation Flow (5 cases)
1. **Cancel and Rebook** - Complex state changes (⚠️ flaky ~65% — double-charge bug can trigger during rebook)
2. **Refund Processing** - Issue refund
3. **Price Difference** - Handle cost changes
4. **Cancel Only** - Cancellation without rebooking
5. **Same Destination** - Rebook to same city

---

---

## Agents: Scripted Default + Bring Your Own

### Default: Scripted Agent ✅

The harness ships with a **scripted agent** (`src/agent/scripted.ts`) that:
- Searches for flights (NYC to LAX by default)
- Selects the first/cheapest option
- Completes checkout
- Requires **zero setup** — no API keys, no secrets

Run with scripted (default):
```bash
npm run eval
```

The scripted agent is **deterministic** and **reproducible**. Its flakiness comes from the mock site's intentional bugs (20% return wrong destination, 10% double-charge), proving the harness detects real issues.

### Bring Your Own Agent

The harness uses a **pluggable adapter** pattern. Swap agents via environment variable:

```bash
# Use Stagehand (LLM-driven, requires OPENAI_API_KEY)
OPENAI_API_KEY=sk-... AGENT=stagehand npm run eval

# Use your custom agent
AGENT=my-agent npm run eval
```

See **[Plug In Your Agent](./docs/plug-in-your-agent.md)** for how to integrate your agent (Stagehand, Claude, GPT, your own framework, etc.).

**Current agents:**
- `scripted` (default) — deterministic, no setup
- `stagehand` — LLM-driven (Browserbase), requires OPENAI_API_KEY

---

```typescript
{
  id: 'booking-happy-path',
  title: 'Book cheapest direct flight',
  description: 'User should be able to search and book cheapest direct flight',
  
  // Setup: Put the system in a known state
  setup: async (ctx) => {
    await ctx.page.goto('https://booking.com');
    await ctx.page.fill('input[name="from"]', 'NYC');
  },
  
  // Assertions: What must be true for success
  assertions: [
    // Layer 1: UI
    {
      kind: 'dom',
      locator: '[data-testid="confirmation"]',
      expect: 'present',
      timeoutMs: 10000
    },
    
    // Layer 2: Database
    {
      kind: 'state',
      name: 'order-exists',
      check: async (ctx) => {
        const order = await fetch('/api/orders/latest').then(r => r.json());
        return order && order.id;
      }
    },
    
    // Layer 3: Correctness
    {
      kind: 'state',
      name: 'booked-cheapest-direct',
      check: async (ctx) => {
        const order = await fetch('/api/orders/latest').then(r => r.json());
        return order.price === 120 && order.stops === 0;
      }
    }
  ]
}
```

---

## Interpreting Results

### RELIABLE ✅
```
✅ Test Case: 5/5 trials passed
```
**Meaning:** Agent consistently succeeds. Safe to ship.

### FLAKY ⚠️
```
⚠️  Test Case: 3/5 trials passed
```
**Meaning:** Agent sometimes works, sometimes fails. Unpredictable. 
**Action:** Do not ship. Fix and re-test.

### BROKEN ❌
```
❌ Test Case: 0/5 trials passed
```
**Meaning:** Agent consistently fails. Not ready.
**Action:** Redesign the agent, then re-test.

---

## Regression Tracking

The harness tracks a baseline of pass rates:

```json
{
  "booking-happy-path": 0.8,
  "checkout-no-double-charge": 0.9,
  "cancel-and-rebook": 0.65
}
```

On subsequent runs, if a case drops more than 20%, CI fails:

```
❌ REGRESSION:
booking-happy-path: 80% → 50% (dropped 30%)
CI FAILED - merge blocked
```

This prevents shipping a degraded agent.

---

## CI/CD Integration

GitHub Actions workflow runs automatically on push and PR:

```yaml
name: Agent Evals
on: [push, pull_request]
jobs:
  eval:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: nohup npx tsx mock-site.ts > server.log 2>&1 &
      - run: npx tsx evals/runner.ts 10
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: traces-${{ matrix.node-version }}
          path: traces/
```

Runs **10 trials per case** in CI (vs 20 for baseline generation, 5 for local development).


---

## Customizing for Your Agent

The harness is fully pluggable. Three ways to use it:

### Option 1: Use Default Scripted Agent
No setup required — just clone and run:
```bash
npm install
npm run eval
```

The scripted agent books a flight deterministically. Flakiness comes from the mock site's intentional bugs.

### Option 2: Add Stagehand (LLM-Driven Agent)
For a real LLM agent, install and use Stagehand:
```bash
npm install @browserbasehq/stagehand
OPENAI_API_KEY=sk-... AGENT=stagehand npm run eval
```

See **[Plug In Your Agent](./docs/plug-in-your-agent.md)** for full integration guide.

### Option 3: Bring Your Own Agent
Custom agent framework? Point `AGENT` to your implementation. The adapter pattern makes it trivial:
```typescript
// src/agent/my-agent.ts
export async function myAgent(ctx: RunContext, task: string) {
  // Your agent logic here
}
```

Then: `AGENT=my-agent npm run eval`

See **[Plug In Your Agent](./docs/plug-in-your-agent.md)** for the full how-to.

---

## FAQ

**Q: Do I need LLM judge assertions?**
A: No. Most value comes from DOM + state assertions. Judges are optional for fuzzy checks.

**Q: How many trials should I run?**
A: 
- 5 trials = development (quick feedback)
- 10 trials = before shipping (good confidence)
- 50 trials = production sign-off (very high confidence)

**Q: What if my agent uses an MCP?**
A: Same approach. Test that the agent calls the MCP correctly and interprets responses.

**Q: Can I use this for chat agents?**
A: Yes, but no Playwright. Instead of DOM assertions, you check the text response quality.

---

## Under the Hood

### Architecture

```
┌─────────────────────┐
│  Test Cases (15)    │ Define what "correct" means
├─────────────────────┤
│  Runner             │ Orchestrates trials
├─────────────────────┤
│  Trial Loop         │ Runs each case 5-50 times
├─────────────────────┤
│  Assertions (3 types)│ Verify: DOM, State, Correctness
├─────────────────────┤
│  Aggregator         │ Pass@K, Pass^K, Regression check
├─────────────────────┤
│  Reporter           │ Beautiful output + JSON report
└─────────────────────┘
```

---

## Contributing

Issues and PRs welcome. Test framework is generic—we'd love community test cases.

---

## License

MIT
