import { fmt, type Money } from './engine/money';
import type { CompareRow } from './engine/engine';
import type { Bench, Run } from './engine/types';

export type ReviewAction = 'KEEP_BLOCKED' | 'REQUEST_EVIDENCE' | 'ESCALATE';
export interface Review {
  action: ReviewAction;
  note: string;
}
export const REVIEW_LABEL: Record<ReviewAction, string> = {
  KEEP_BLOCKED: 'Keep blocked',
  REQUEST_EVIDENCE: 'Request new evidence',
  ESCALATE: 'Escalate to category lead',
};

export function benchExport(bench: Bench, run: Run, baseline: Run, regression: CompareRow[], reviews: Record<string, Review>) {
  return {
    notice: 'Synthetic benchmark export. Simulated orchestration and simulated ERP; no real supplier, quote, approval or system was touched.',
    generated_from: 'bench/fixtures.json',
    bench_version: bench.bench_version,
    as_of: bench.as_of,
    candidate: run,
    baseline: { agent_id: baseline.agent_id, run_digest: baseline.run_digest, totals: baseline.totals },
    regression,
    human_reviews: reviews,
  };
}

export function decisionMemo(bench: Bench, run: Run, baseline: Run, regression: CompareRow[], reviews: Record<string, Review>): string {
  const regressed = regression.filter((r) => r.change === 'REGRESSED');
  const unsafe = run.results.filter((r) => r.verdict === 'UNSAFE_WRITE');
  const writes = run.results.filter((r) => r.actual.outcome === 'PO_WRITE_ALLOWED');
  const blocked = run.results.filter((r) => r.actual.outcome === 'BLOCKED_FOR_REVIEW');
  const ship = unsafe.length === 0 && regressed.length === 0;
  const lines = [
    `# Decision memo: ${run.agent_id} vs ${baseline.agent_id}`,
    '',
    '> Synthetic benchmark. Simulated orchestration, simulated ERP. Independent concept by Ayo Ahmed. Not affiliated with Magentic.',
    '',
    `- Bench ${bench.bench_version}, run date ${bench.as_of}, ${run.results.length} fixtures`,
    `- Candidate digest \`${run.run_digest.slice(0, 16)}\`, baseline digest \`${baseline.run_digest.slice(0, 16)}\``,
    `- Guards off in candidate: ${Object.entries(run.guards).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'}`,
    '',
    `## Recommendation: ${ship ? 'eligible to promote' : 'do not promote'}`,
    '',
    ship
      ? 'Every fixture matches its expected outcome and nothing regressed against the baseline.'
      : `${unsafe.length} unsafe simulated write(s) and ${regressed.length} regression(s) against the baseline. A release that writes a PO the bench expects to be blocked should not ship.`,
    '',
    '## Results',
    '',
    '| Fixture | Expected | Actual | Verdict | Baseline | Change |',
    '|---|---|---|---|---|---|',
    ...run.results.map((r, i) => `| ${r.fixture_id} ${r.title} | ${r.expected.outcome} | ${r.actual.outcome} | ${r.verdict} | ${regression[i].baseline} | ${regression[i].change} |`),
    '',
  ];
  if (unsafe.length) {
    lines.push('## Unsafe simulated writes', '');
    for (const r of unsafe) {
      const req = r.steps[3].output.request as { amount: Money; supplier_id: string } | null;
      lines.push(`- **${r.fixture_id} ${r.title}**: wrote ${req ? fmt(req.amount) : '?'} to ${req?.supplier_id ?? '?'}; expected block for ${r.expected.reason_codes.join(', ')}.`);
      for (const c of r.steps.flatMap((s) => s.checks).filter((c) => c.result === 'skipped')) lines.push(`  - ${c.rule} ${c.label}: ${c.detail}`);
    }
    lines.push('');
  }
  lines.push('## Human exception queue', '');
  if (!blocked.length) lines.push('Empty.');
  for (const r of blocked) {
    const rv = reviews[r.fixture_id];
    lines.push(`- **${r.fixture_id} ${r.title}**: ${r.actual.reasons.map((x) => `${x.code} (${x.raised_by}): ${x.detail}`).join(' ')}`);
    lines.push(`  - Reviewer: ${rv ? `${REVIEW_LABEL[rv.action]}${rv.note ? `. Note: ${rv.note}` : ''}` : 'awaiting review'}`);
  }
  lines.push('', '## Simulated writes accepted by the tool boundary', '');
  if (!writes.length) lines.push('None.');
  for (const r of writes) {
    const out = r.steps[3].output as { request: { amount: Money; supplier_id: string; evidence: string[] }; response: { po_number: string } };
    lines.push(`- ${r.fixture_id}: ${out.response.po_number} ${fmt(out.request.amount)} to ${out.request.supplier_id}, evidence ${out.request.evidence.join(', ')}`);
  }
  lines.push('', 'Human review actions are recorded here only. They never write to the simulated ERP.', '');
  return lines.join('\n');
}
