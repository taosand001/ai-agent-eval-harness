// Main test runner - orchestrates trials and generates reports

import { chromium, Browser } from 'playwright';
import type { EvalCase, Trial, CaseResult, EvalReport, RunContext } from '../src/types.js';
import { checkAssertion } from '../src/assertions.js';
import { bookingCases } from './cases/booking.js';
import { checkoutCases } from './cases/checkout.js';
import { cancellationCases } from './cases/cancellation.js';
import * as fs from 'fs';
import * as path from 'path';

const allCases = [...bookingCases, ...checkoutCases, ...cancellationCases];

async function runTrial(browser: Browser, evalCase: EvalCase, trialNum: number): Promise<Trial> {
  let context = null;
  let page = null;
  const startTime = Date.now();

  try {
    context = await browser.newContext();
    await context.tracing.start({ screenshots: true, snapshots: true });

    page = await context.newPage();

    const tracePath = path.join('traces', `${evalCase.id}-${trialNum}.zip`);

    const ctx: RunContext = {
      browser,
      context,
      page,
      transcript: [],
      tracePath,
    };

    // Setup the case
    if (evalCase.setup) {
      await evalCase.setup(ctx);
    }

    // Run assertions
    const outcomes = await Promise.all(
      evalCase.assertions.map((a) => checkAssertion(a, ctx))
    );

    const pass = outcomes.every((o) => o.pass);

    return {
      pass,
      outcomes,
      ms: Date.now() - startTime,
      costUsd: 0.01, // Demo: fixed cost
    };
  } catch (e) {
    return {
      pass: false,
      outcomes: [],
      ms: Date.now() - startTime,
      costUsd: 0.01,
      error: String(e),
    };
  } finally {
    if (page) await page.close();
    if (context) {
      await context.tracing.stop({ path: `traces/${evalCase.id}-${trialNum}.zip` }).catch(() => {});
      await context.close();
    }
  }
}

function summarizeCase(evalCase: EvalCase, trials: Trial[]): CaseResult {
  const passed = trials.filter((t) => t.pass).length;
  const total = trials.length;

  let kind: 'reliable' | 'flaky' | 'broken';
  if (passed === total) {
    kind = 'reliable';
  } else if (passed === 0) {
    kind = 'broken';
  } else {
    kind = 'flaky';
  }

  const avgMs = Math.round(trials.reduce((sum, t) => sum + t.ms, 0) / total);
  const totalCostUsd = trials.reduce((sum, t) => sum + t.costUsd, 0);

  return {
    id: evalCase.id,
    title: evalCase.title,
    trials: total,
    passed,
    passAtK: passed > 0,
    passHatK: passed === total,
    kind,
    avgMs,
    totalCostUsd,
  };
}

function loadBaseline(): { [key: string]: number } {
  try {
    return JSON.parse(fs.readFileSync('evals/baseline.json', 'utf-8'));
  } catch {
    return {};
  }
}

function saveBaseline(results: CaseResult[]) {
  const baseline: { [key: string]: number } = {};
  results.forEach((r) => {
    baseline[r.id] = r.passed / r.trials;
  });
  fs.writeFileSync('evals/baseline.json', JSON.stringify(baseline, null, 2));
}

function checkRegressions(results: CaseResult[], baseline: { [key: string]: number }): string[] {
  const regressions: string[] = [];
  results.forEach((r) => {
    if (baseline[r.id]) {
      const oldRate = baseline[r.id];
      const newRate = r.passed / r.trials;
      if (newRate < oldRate - 0.1) {
        regressions.push(
          `${r.id}: ${(oldRate * 100).toFixed(0)}% → ${(newRate * 100).toFixed(0)}%`
        );
      }
    }
  });
  return regressions;
}

async function main() {
  const trialsPerCase = process.argv[2] ? parseInt(process.argv[2]) : 5;

  console.log('\n' + '='.repeat(70));
  console.log('🧪 AI AGENT EVAL HARNESS');
  console.log('='.repeat(70));
  console.log(`\n📊 Running ${allCases.length} test cases × ${trialsPerCase} trials each\n`);

  if (!fs.existsSync('traces')) {
    fs.mkdirSync('traces', { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const allResults: CaseResult[] = [];

  for (const evalCase of allCases) {
    console.log(`\n📝 ${evalCase.title}`);
    console.log(`   Description: ${evalCase.description}`);
    console.log(`   Running ${trialsPerCase} trials...`);

    const trials: Trial[] = [];
    for (let i = 1; i <= trialsPerCase; i++) {
      process.stdout.write(`   Trial ${i}...`);
      const trial = await runTrial(browser, evalCase, i);
      trials.push(trial);
      console.log(` ${trial.pass ? '✅' : '❌'}`);
    }

    const result = summarizeCase(evalCase, trials);
    allResults.push(result);

    console.log(`   Result: ${result.passed}/${result.trials} passed`);
    console.log(`   Status: ${result.kind.toUpperCase()}`);
  }

  await browser.close();

  // Generate report
  const baseline = loadBaseline();
  const regressions = checkRegressions(allResults, baseline);

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    totalCases: allResults.length,
    totalTrials: allResults.reduce((sum, r) => sum + r.trials, 0),
    totalPassed: allResults.reduce((sum, r) => sum + r.passed, 0),
    results: allResults,
    baseline,
    regressions,
  };

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 TEST RESULTS SUMMARY');
  console.log('='.repeat(70));

  allResults.forEach((r) => {
    const icon =
      r.kind === 'reliable' ? '✅' : r.kind === 'flaky' ? '⚠️' : '❌';
    console.log(`\n${icon} ${r.title}`);
    console.log(`   ${r.passed}/${r.trials} trials passed (${Math.round((r.passed / r.trials) * 100)}%)`);
    console.log(`   Status: ${r.kind}`);
    console.log(`   Avg time: ${r.avgMs}ms | Cost: $${r.totalCostUsd.toFixed(2)}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('📊 AGGREGATE METRICS');
  console.log('='.repeat(70));

  const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
  const totalTrials = allResults.reduce((sum, r) => sum + r.trials, 0);
  const passRate = Math.round((totalPassed / totalTrials) * 100);

  console.log(`\nTotal: ${totalPassed}/${totalTrials} assertions passed (${passRate}%)`);
  console.log(`Reliable: ${allResults.filter((r) => r.kind === 'reliable').length}`);
  console.log(`Flaky: ${allResults.filter((r) => r.kind === 'flaky').length}`);
  console.log(`Broken: ${allResults.filter((r) => r.kind === 'broken').length}`);

  if (regressions.length > 0) {
    console.log('\n⚠️  REGRESSIONS DETECTED:');
    regressions.forEach((r) => console.log(`   - ${r}`));
    process.exit(1);
  }

  // Save baseline for next run
  saveBaseline(allResults);

  // Save JSON report
  fs.writeFileSync('evals/report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Report saved to evals/report.json');
  console.log('✅ Baseline saved to evals/baseline.json');
}

main().catch(console.error);
