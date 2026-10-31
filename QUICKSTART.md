# Quick Start Guide

Get running in 5 minutes.

## 1. Install

```bash
npm install
npx playwright install
```

## 2. Start the Mock Server

This simulates a booking website with intentional bugs (for demo):

```bash
npm run mock-server
```

You should see:
```
Mock flight booking site running at http://localhost:3000
Contains intentional bugs for testing:
  BUG #1: 20% of searches return wrong destination
  BUG #2: 10% of bookings double-charge
```

**In another terminal** (or background), run the harness:

## 3. Run the Evals

```bash
npm run eval
```

This runs **5 trials** of each of the 15 test cases.

Expected output:
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
```

## 4. Understand the Results

Three possible outcomes for each test case:

| Status | Meaning | Action |
|--------|---------|--------|
| **✅ RELIABLE** | 5/5 trials passed | Ship it |
| **⚠️ FLAKY** | 3/5 trials passed | Fix it first |
| **❌ BROKEN** | 0/5 trials passed | Redesign it |

## 5. Run More Trials (for higher confidence)

```bash
npm run eval:10  # 10 trials per case (50 total)
npm run eval:50  # 50 trials per case (250 total) - production sign-off
```

## Next Steps

- **Customize:** Edit `evals/cases/*.ts` to match YOUR agent's workflows
- **CI/CD:** Push to GitHub, GitHub Actions runs automatically on every commit
- **Track:** Baseline gets saved to `evals/baseline.json`, regressions block merges

## File Structure

```
├── evals/
│   ├── cases/
│   │   ├── booking.ts          ← Define booking test cases
│   │   ├── checkout.ts         ← Define checkout test cases
│   │   └── cancellation.ts     ← Define cancellation test cases
│   ├── runner.ts               ← Main test orchestrator
│   ├── baseline.json           ← Baseline pass rates (for regression tracking)
│   └── report.json             ← Latest test results
├── src/
│   ├── types.ts                ← Type definitions
│   └── assertions.ts           ← Assertion runners (DOM, state, judge)
├── mock-site.js                ← Demo website with bugs
├── README.md                   ← Full documentation
├── QUICKSTART.md              ← This file
└── package.json
```

## Troubleshooting

**"Cannot find module 'playwright'"**
```bash
npm install
npx playwright install
```

**"localhost:3000 refused connection"**
- Make sure mock server is running: `npm run mock-server`

**"Timeout waiting for selector"**
- This is expected behavior! The harness tests for failures. Check the detailed output.

**"Regressions detected"**
- Your agent got worse since last run. Check `evals/report.json` to see which cases regressed.

## Tips

1. **During development:** Use `npm run eval` (5 trials, quick)
2. **Before shipping:** Use `npm run eval:50` (50 trials, high confidence)
3. **In CI/CD:** Configured to run `npm run eval:10` on every PR
4. **Reading output:** 
   - Green ✅ = good
   - Orange ⚠️ = needs attention
   - Red ❌ = broken

## What to Customize

Edit these files to match YOUR agent:

### 1. Test Cases
`evals/cases/*.ts` — Define what success means
- What is the task?
- What assertions must pass?
- What edge cases to test?

### 2. Assertions
`src/assertions.ts` — Add custom checks
- DOM assertions (UI visible/hidden)
- State assertions (database checks)
- Judge assertions (LLM scoring)

### 3. Setup
In each case's `setup` function:
- Pre-populate data (existing bookings)
- Set user auth state
- Configure environment

## Example: Add a Custom Test Case

```typescript
// evals/cases/booking.ts

export const bookingCases: EvalCase[] = [
  // ... existing cases ...
  
  {
    id: 'booking-vip-customer',
    title: 'Book VIP customer (priority upgrade)',
    description: 'VIP customers should get automatic seat upgrade',
    task: 'Book a flight for a VIP customer',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
      // Mark user as VIP
      await ctx.page.evaluate(() => localStorage.setItem('vip', 'true'));
    },
    assertions: [
      {
        kind: 'dom',
        locator: '[data-seat-class="first-class"]',
        expect: 'present'
      },
      {
        kind: 'state',
        name: 'seat-is-first-class',
        check: async (ctx) => {
          const order = await ctx.page.evaluate(() =>
            fetch('/api/orders/latest').then(r => r.json())
          );
          return order.seatClass === 'first-class';
        }
      }
    ]
  }
];
```

Then run:
```bash
npm run eval
```

Your new case runs automatically!

---

**Questions?** See [README.md](./README.md) for full documentation.
