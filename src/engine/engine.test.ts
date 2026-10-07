import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import benchJson from '../../bench/fixtures.json';
import { compareRuns, runBench } from './engine';
import { convert, fmt, money } from './money';
import type { Bench, Run } from './types';

const bench = benchJson as unknown as Bench;
const golden = (id: string) => JSON.parse(readFileSync(resolve(__dirname, `../../bench/golden/${id}.json`), 'utf8')) as Run;

describe('parity with the Python evaluation module', () => {
  for (const agent of bench.agents) {
    it(`${agent.id} matches bench/golden/${agent.id}.json exactly`, () => {
      const run = runBench(bench, agent.id);
      expect(run).toEqual(golden(agent.id));
      expect(run.run_digest).toBe(golden(agent.id).run_digest);
    });
  }
});

describe('money', () => {
  it('converts with half-even rounding on integer minor units', () => {
    expect(convert(money(294000, 'EUR'), 'GBP', '0.8571')).toEqual(money(251987, 'GBP'));
    expect(convert(money(1, 'EUR'), 'GBP', '0.5').minor).toBe(0);
    expect(convert(money(3, 'EUR'), 'GBP', '0.5').minor).toBe(2);
  });
  it('formats with explicit currency', () => {
    expect(fmt(money(4800000, 'GBP'))).toBe('GBP 48,000.00');
  });
  it('rejects non-integer minor units', () => {
    expect(() => money(1.5, 'GBP')).toThrow();
  });
});

describe('regression comparison', () => {
  it('flags only F06 when the freshness guard is dropped', () => {
    const rows = compareRuns(runBench(bench, 'v2.4-baseline'), runBench(bench, 'v2.5-rc'));
    expect(rows.filter((r) => r.change === 'REGRESSED').map((r) => r.fixture_id)).toEqual(['F06']);
  });
});
