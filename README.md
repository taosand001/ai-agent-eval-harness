# AI Agent Eval Harness

A production-ready test framework for verifying AI browser agents are reliable before shipping to production.

## Problem

You built an AI agent to automate browser tasks (book flights, checkout, manage orders). It works when you test it manually. But:

- ❓ Does it work **consistently**? Or just sometimes?
- ❓ Does it **actually do** what it claims? Or just say it did?
- ❓ What breaks when things don't go perfectly?
- ❓ Can you **ship this** with confidence?

## Solution

Run your agent **50 times in CI**. Catch bugs before your customers do.

```bash
npm run eval
```

Output:
```
✅ Book Cheapest Flight:    5/5 passed (100%) - RELIABLE
✅ Handle Connections:      5/5 passed (100%) - RELIABLE
✅ Recover from Errors:     5/5 passed (100%) - RELIABLE
✅ Compare Options:         5/5 passed (100%) - RELIABLE
⚠️  Correct Date:           0/5 passed (0%)   - BROKEN (known issue)
⚠️  No Double Charge:       0/5 passed (0%)   - BROKEN (assertion bug)
✅ Correct Amount:          5/5 passed (100%) - RELIABLE
✅ Confirmation Email:      5/5 passed (100%) - RELIABLE
✅ Timeout Handling:        5/5 passed (100%) - RELIABLE
✅ Invalid Payment:         5/5 passed (100%) - RELIABLE
❌ Cancel and Rebook:       0/5 passed (0%)   - BROKEN (WIP)
❌ Process Refund:          0/5 passed (0%)   - BROKEN (WIP)
❌ Price Difference:        0/5 passed (0%)   - BROKEN (WIP)
❌ Cancel Only:             0/5 passed (0%)   - BROKEN (WIP)
❌ Same Destination:        0/5 passed (0%)   - BROKEN (WIP)

AGGREGATE: 9/15 cases reliable (60%), 1 flaky (7%), 5 WIP (33%)
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

**Layer 3: Judge** - Was the behavior correct? (requires LLM)
```typescript
{
  kind: 'judge',
  rubric: 'Did the agent book for the right date?',
  threshold: 0.8
}
```

### 4. Regression Tracking (CI Gate)

First run establishes baseline:
```json
{
  "booking-happy-path": 1.0,
  "checkout-no-double-charge": 1.0,
  "cancel-and-rebook": 0.8
}
```

Next runs check for regressions:
```
❌ REGRESSION DETECTED:
- booking-happy-path: 100% → 60% (drop of 40%)
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

### Output

```
🧪 AI AGENT EVAL HARNESS

📝 Book Cheapest Flight
   Running 5 trials...
   Trial 1... ✅
   Trial 2... ✅
   Trial 3... ❌
   Trial 4... ✅
   Trial 5... ✅
   Result: 4/5 passed
   Status: FLAKY

...

📋 TEST RESULTS SUMMARY
✅ Booking Happy Path:       5/5 (RELIABLE)
⚠️  No Double Charge:        4/5 (FLAKY)
❌ Cancel and Rebook:        2/5 (FLAKY)

📊 AGGREGATE METRICS
Total: 53/75 assertions passed (71%)
```

---

## Understanding Flakiness & The Regression Gate

### Expected Flakiness

This harness includes **intentional bugs** in the mock site to demonstrate real-world issues:

- **20% search bug**: Returns wrong destination 20% of the time → `booking-happy-path` flaky at ~85%
- **10% double-charge bug**: Charges twice 10% of the time → `checkout-correct-amount` flaky at ~85%
- **Rare race condition**: Cancellation/rebooking can collide → `cancel-and-rebook` flaky at ~80%

This is **intentional**. Flakiness from known bugs proves the harness detects them. A stable gate would mask issues.

### Regression Gate (20% Tolerance)

The baseline is generated with **20 trials per case** to reduce noise. The gate flags regressions when:

```
newRate < oldRate - 0.20   (20% drop in pass rate)
```

**Why 20%?** With 20 trials at p=0.85, variance means legitimate runs vary ±15%. A 10% tolerance would trip on normal variance half the time. 20% catches real regressions while surviving noisy estimates:

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
1. **Cancel and Rebook** - Complex state changes (⚠️ flaky ~80% — double-charge bug can trigger during rebook)
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
  "booking-happy-path": 1.0,
  "checkout-no-double-charge": 1.0,
  "cancel-and-rebook": 0.8
}
```

On subsequent runs, if a case drops more than 10%, CI fails:

```
❌ REGRESSION:
booking-happy-path: 100% → 60% (dropped 40%)
CI FAILED - merge blocked
```

This prevents shipping a broken agent.

---

## CI/CD Integration

GitHub Actions workflow runs automatically on push:

```yaml
name: Agent Evals
on: [push, pull_request]
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install && npx playwright install
      - run: npm run eval:10
```

---

## Customizing for Your Agent

### Option 1: Use as Template
```bash
git clone <this-repo>
cd your-agent-evals
# Edit evals/cases/*.ts with YOUR specific cases
npm run eval
```

### Option 2: Add to Your Repo
```bash
cp -r evals/ your-repo/
npm install --save-dev @browserbasehq/stagehand playwright
npm run eval
```

### Option 3: Custom Implementation
Use this as reference architecture. The pattern is:

1. Define cases (what success looks like)
2. Run trials (multiple runs to catch flakiness)
3. Check assertions (UI, database, correctness)
4. Report results (pass@k, pass^k, regressions)

---

## Pricing & Services

**If you need help setting this up:**

- **Pilot ($4,500):** We build a custom harness for your agent, 2 weeks, fully customized to your use case
- **Retainer ($5-7k/month):** Ongoing maintenance as your agent evolves
- **Ad-hoc ($850/day):** One-off work, emergency debugging

[Book a call](https://calendly.com/yourdomain)

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

### Cost Tracking

Each assertion execution tracks cost (if using LLM judges):

```json
{
  "case": "booking",
  "trial": 1,
  "costUsd": 0.03,
  "breakdown": {
    "dom_assertions": 0.0,
    "state_assertions": 0.0,
    "judge_assertion": 0.03
  }
}
```

---

## Example Output

```
🧪 AI AGENT EVAL HARNESS

📝 Book Cheapest Flight
   Running 5 trials...
   Trial 1... ✅
   Trial 2... ✅
   Trial 3... ✅
   Trial 4... ✅
   Trial 5... ✅
   Result: 5/5 passed
   Status: RELIABLE

📝 No Double Charge
   Running 5 trials...
   Trial 1... ✅
   Trial 2... ❌ (charged twice)
   Trial 3... ✅
   Trial 4... ✅
   Trial 5... ❌ (charged twice)
   Result: 3/5 passed
   Status: FLAKY

📋 TEST RESULTS SUMMARY
✅ Book Cheapest Flight:     5/5 (RELIABLE)
⚠️  No Double Charge:        3/5 (FLAKY)
❌ Cancel and Rebook:        2/5 (FLAKY)

📊 AGGREGATE METRICS
Total: 53/75 assertions passed (71%)
Reliable: 5
Flaky: 8
Broken: 2

⚠️  REGRESSIONS DETECTED:
- checkout-no-double-charge: 100% → 60% (dropped 40%)

CI FAILED
```

---

## Contributing

Issues and PRs welcome. Test framework is generic—we'd love community test cases.

---

## License

MIT
