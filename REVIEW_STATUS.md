# Status After Latest Review Fixes

## ✅ Completed (Critical Path)

1. **CI Environment Drift Fixed**
   - ✅ Removed old mock-site.js (was 404'ing on /api/reset, /api/cancel)
   - ✅ Workflow now uses `tsx mock-site.ts` (TypeScript version with all endpoints)
   - ✅ Removed Node 18 (EOL), using 20.x and 22.x
   - ✅ Added `--with-deps` to playwright install
   - ✅ Removed `continue-on-error: true` (fail fast on server errors)
   - ✅ Upgraded artifact actions v3 → v4

2. **Baseline Gating Fixed**
   - ✅ Added `--update-baseline` flag (only write on explicit request)
   - ✅ Generated fresh baseline from current run
   - ✅ Baseline now prevents silent regressions in CI

3. **Mock Site Improvements**
   - ✅ Added `date` field to Flight interface
   - ✅ Search endpoint now returns flights with date
   - ✅ `/api/cancel` endpoint implemented
   - ✅ `/api/reset` working (clears orders array)

4. **Assertion Fixes**
   - ✅ booking-correct-date: checks date field correctly
   - ✅ checkout-no-double-charge: now verifies order count + charged === 1
   - ✅ checkout-correct-amount: now checks charged === 1 (not just price > 0)

5. **Type Safety**
   - ✅ Changed Order imports to `import type` in all case files

## 🟠 Current Results

```
✅ 7 Reliable (100% pass rate)
⚠️  1 Flaky (60% pass rate - booking-happy-path from known bug)
❌ 7 Broken (0% pass rate - 5 cancellation WIP, 2 checkout pending fixes)
```

Pass Rate: 51% (38/75 assertions)

## ❌ Remaining Blockers

### 1. Cancellation Cases (5 cases, 0/5 pass rate)
- Agent doesn't properly handle cancellation flow
- All 5 cases fail because agent can't execute "cancel" tasks
- Setup provides pre-existing bookings but agent fails to cancel them
- Need: Debugging agent error handling and /api/cancel calls

### 2. Checkout No Double-Charge (0/5 pass rate)
- New assertions checking: `orders.length === 1 && orders[0].charged === 1`
- 10% of time, the double-charge bug triggers (2 orders, charged=2)
- Question: Should assertion pass when double-charge bug is detected?
- Or should it expect 1 order with charged === 1 (pass) vs 2 orders (fail)?

### 3. Booking Happy-Path Regressed (60%, was 80%)
- From 4/5 to 3/5 trials passing
- Likely from the mock-site changes or assertion changes
- Need to debug which assertion is failing

## 📋 Next Steps (Priority Order)

1. **Debug & Fix Cancellation Agent** (gets 5 cases to green = 1/3 of demo)
   - Add error logging to handleCancellation
   - Verify /api/cancel is callable
   - Test cancellation flow manually
   
2. **Fix Checkout Double-Charge Assertion** 
   - Decide: should 10% double-charge bug be caught?
   - If yes: assertion should fail when charged !== 1
   - If no: remove that case as untestable
   
3. **Investigate booking-happy-path Regression**
   - Compare assertions between runs
   - Check if date field addition broke something

## 🎯 Ship-Ready Criteria

- [ ] All 15 cases at least ≥50% pass rate
- [ ] At least 10 cases RELIABLE (100%)
- [ ] Cancellation cases moved from 0% to ≥80%
- [ ] Baseline committed, regression gate working
- [ ] No outstanding P0 issues

Current: 7/15 reliable (47%). Need 3 more to 66% green status.
