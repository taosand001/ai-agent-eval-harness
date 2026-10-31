// Core types for the eval harness

import type { Page, BrowserContext, Browser } from 'playwright';

export type AssertionKind = 'dom' | 'state' | 'judge';

export interface DOMAssertion {
  kind: 'dom';
  locator: string;
  expect: 'present' | 'absent';
  timeoutMs?: number;
}

export interface StateAssertion {
  kind: 'state';
  name: string;
  check: (ctx: RunContext) => Promise<boolean>;
}

export interface JudgeAssertion {
  kind: 'judge';
  rubric: string;
  threshold: number;
}

export type Assertion = DOMAssertion | StateAssertion | JudgeAssertion;

export interface EvalCase {
  id: string;
  title: string;
  description: string;
  task: string;
  setup?: (ctx: RunContext) => Promise<void>;
  assertions: Assertion[];
}

export interface RunContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  transcript: string[];
  tracePath: string;
}

export interface AssertionOutcome {
  assertion: string;
  pass: boolean;
  detail?: string;
}

export interface Trial {
  pass: boolean;
  outcomes: AssertionOutcome[];
  ms: number;
  costUsd: number;
  error?: string;
}

export interface CaseResult {
  id: string;
  title: string;
  trials: number;
  passed: number;
  passAtK: boolean;
  passHatK: boolean;
  kind: 'reliable' | 'flaky' | 'broken';
  avgMs: number;
  totalCostUsd: number;
}

export interface EvalReport {
  timestamp: string;
  totalCases: number;
  totalTrials: number;
  totalPassed: number;
  results: CaseResult[];
  baseline?: { [key: string]: number };
  regressions: string[];
}
