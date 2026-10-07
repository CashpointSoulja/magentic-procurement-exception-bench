import benchJson from '../bench/fixtures.json';
import { compareRuns, runBench } from './engine/engine';
import type { Bench } from './engine/types';
import { benchExport, decisionMemo } from './memo';

const bench = benchJson as unknown as Bench;
const base = runBench(bench, 'v2.4-baseline');

describe('decision memo', () => {
  it('recommends not promoting the regressed candidate and names the unsafe write', () => {
    const rc = runBench(bench, 'v2.5-rc');
    const memo = decisionMemo(bench, rc, base, compareRuns(base, rc), { F07: { action: 'REQUEST_EVIDENCE', note: 'need scoped approval' } });
    expect(memo).toContain('## Recommendation: do not promote');
    expect(memo).toContain('**F06 Stale quote**: wrote GBP 1,947.00 to SUP-1188');
    expect(memo).toContain('Reviewer: Request new evidence. Note: need scoped approval');
    expect(memo).toContain('Not affiliated with Magentic');
  });
  it('marks the baseline eligible and exports the full run', () => {
    const memo = decisionMemo(bench, base, base, compareRuns(base, base), {});
    expect(memo).toContain('eligible to promote');
    const ex = benchExport(bench, base, base, compareRuns(base, base), {});
    expect(ex.candidate.run_digest).toBe(base.run_digest);
    expect(ex.notice).toMatch(/Synthetic/);
  });
});
