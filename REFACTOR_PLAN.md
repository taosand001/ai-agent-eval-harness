# Harness Refactor: Agent-Agnostic Architecture

## Goal
Transform from "travel booking + browser-only harness" to "generic evaluation platform for any agent + any system."

## Core Principles (No Compromises)

1. **No overpromising in docs** — Only claim what actually works
2. **Assertions must be meaningful** — No tautologies, no asserts that pass by design
3. **Statistics must be rigorous** — Wilson intervals, proper confidence levels
4. **Error handling must be loud** — Failing silently is worse than crashing
5. **Portfolio != Product** — Mock site is ONLY for case studies, not for sale
6. **One source of truth** — No duplicated test cases, no stale docs

---

## Architecture Decision: What's Pluggable?

### Agent Interface (Pluggable)
```typescript
interface AgentAdapter {
  init(): Promise<void>;
  execute(task: AgentTask): Promise<AgentResult>;
  cleanup(): Promise<void>;
}

type AgentTask = {
  id: string;
  instructions: string;
  context?: Record<string, unknown>;
  timeout?: number;
};

type AgentResult = {
  success: boolean;
  output?: unknown;
  error?: string;
  traces: TraceSnapshot[];
  duration: number;
};
```

**Implementations needed:**
- `StagehandAdapter` (browser automation)
- `BrowserUseAdapter` (Python browser-use)
- `ClaudeToolUseAdapter` (Claude tool-use API calls)
- (Later) Custom adapters

**Not pluggable here:**
- Trial loop (shared logic)
- Baseline calculation (shared logic)
- Report generation (shared logic)

---

### System Interface (Pluggable)
```typescript
interface SystemUnderTest {
  init(): Promise<void>;
  reset(): Promise<void>;
  getState(): Promise<SystemState>;
  cleanup(): Promise<void>;
  getTrace(): TraceSnapshot;
}

type SystemState = {
  timestamp: number;
  data: Record<string, unknown>;
};

type TraceSnapshot = {
  timestamp: number;
  logs?: string[];
  events?: Record<string, unknown>;
  errors?: string[];
};
```

**Implementations needed:**
- `HttpMockSystem` (your travel mock site)
- `SalesforceAPISystem` (Salesforce sandbox/prod)
- `HubSpotAPISystem` (HubSpot API)
- (Later) Custom systems

**Critical:** Each system implementation owns:
- How it initializes (connection setup)
- How it resets (cleanup between trials)
- How it captures state (assertions read from this)
- How it collects traces (logs, API calls, DB queries)

---

### Eval Case Interface (Shared, Domain-Specific)
```typescript
interface EvalCase {
  id: string;
  title: string;
  description: string;
  
  // Instructions for the agent
  instructions: string;
  
  // Custom setup per trial
  setup?: (system: SystemUnderTest) => Promise<void>;
  
  // Assertion after agent completes
  assert: (state: SystemState, result: AgentResult) => Promise<{
    passed: boolean;
    reason: string;
  }>;
  
  // Cleanup after assertion
  teardown?: (system: SystemUnderTest) => Promise<void>;
}
```

**Example: Travel booking case**
```typescript
{
  id: 'checkout-no-double-charge',
  title: 'Checkout does not double-charge',
  instructions: 'Book a flight from NYC to LA, complete checkout',
  assert: async (state) => {
    const orders = state.data.orders as Order[];
    const unique = new Set(orders.map(o => o.id));
    return {
      passed: unique.size === orders.length,
      reason: `Got ${orders.length} orders but only ${unique.size} unique`
    };
  }
}
```

---

## Trial Loop (Not Pluggable, But Must Handle Both Cases)

Key decisions:
- Timeout PER TRIAL, not global (a hanging agent doesn't hang entire suite)
- Exceptions don't swallow results (if agent crashes, we record it and move to next trial)
- Traces are ALWAYS collected, even on failure
- `assertionReason` is required (for debugging why a trial failed)

---

## Baseline & Gate (Shared, Statistically Rigorous)

### Gate Logic Using Wilson Score Interval

Key decisions:
- Wilson score interval instead of Clopper-Pearson (standard in ML community)
- Gate compares LOWER BOUNDS, not point estimates (eliminates coin-flip sensitivity)
- 20% tolerance is EXPLICITLY DOCUMENTED (not hidden)
- Confidence intervals are ALWAYS printed in reports

---

## Implementation Stages (Sequential)

### Stage 1: Refactor Core (No Behavior Change)
- [ ] Extract AgentAdapter interface
- [ ] Extract SystemUnderTest interface
- [ ] Refactor trial loop to use interfaces
- [ ] Update travel booking cases to use new interfaces
- [ ] Test: existing travel cases still pass at same rate

### Stage 2: Add Adapters
- [ ] Implement StagehandAdapter
- [ ] Implement BrowserUseAdapter (stub for now)
- [ ] Implement ClaudeToolUseAdapter (stub for now)
- [ ] Test: each adapter can be selected via env var

### Stage 3: Build Portfolio Case Study
- [ ] Run browser-use against travel mock (20 trials)
- [ ] Document findings
- [ ] Create report template showing results
- [ ] Test: report has all required fields

### Stage 4: Add CRM System (Stub)
- [ ] Create SalesforceAPISystem interface (no real connection)
- [ ] Add CRM eval cases (lead routing, etc.)
- [ ] Test: cases load without errors
- [ ] Document: "CRM support ready for client credentials"

### Stage 5: Documentation & Polish
- [ ] Update README with new architecture
- [ ] Add docs/pluggable-adapters.md
- [ ] Add docs/implementing-custom-system.md
- [ ] Remove stale claims, add honest caveats

---

## Red Flags the Reviewer Will Catch (Avoid These)

1. ❌ "Works for browser agents" → then fails on API agents
2. ❌ "Salesforce integration" → but it's stubbed and crashes
3. ❌ "Statistically rigorous" → but uses hardcoded thresholds
4. ❌ "Confidence intervals" → but they're not in the output
5. ❌ "Easy to add new systems" → but it requires editing core files
6. ❌ Docs showing old travel numbers → when new systems have different baselines
7. ❌ Judge layer still claims to work → when it's still a stub
8. ❌ Hardcoded localhost:3000 → when different systems use different endpoints
9. ❌ "No single point of failure" → but traces directory doesn't exist
10. ❌ Placeholder values → calendly, yourusername, etc.

---

## Critical Validation Checklist

- [ ] No assertions that pass by design
- [ ] All hardcoded values are in config
- [ ] Exceptions are logged, not swallowed
- [ ] Confidence intervals computed and printed
- [ ] Gate rule is in code AND documented
- [ ] Baseline format matches documentation
- [ ] README examples match actual output
- [ ] No placeholder values
- [ ] Travel cases pass at ≥95% (if stagehand) or 95% (if scripted)
- [ ] Mock site is clearly marked as "portfolio only"
- [ ] CRM stub is marked as "requires client credentials"

---

## Questions for You Before Implementation

1. **Should I stub CRM systems now or implement one fully?**
   - Option A: Stub SalesforceAPISystem (easier, but incomplete)
   - Option B: Implement real Salesforce connection (harder, but real portfolio value)

2. **Should I touch the mock site or leave it as-is?**
   - Option A: Keep mock-site.ts unchanged
   - Option B: Refactor to use SystemUnderTest interface (cleaner architecture)

3. **Should existing travel cases work exactly as before?**
   - Option A: Yes, same pass rates, same baseline (backward compatible)
   - Option B: Accept ~1-2% variance if architecture requires changes

4. **How aggressive on documentation?**
   - Option A: Minimal docs, focus on code
   - Option B: Full docs/pluggable-adapters.md + examples for each adapter type
