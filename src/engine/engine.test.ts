import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import benchJson from '../../bench/fixtures.json';
import { compareRuns, gatewayCreatePo, runBench } from './engine';
import { convert, fmt, money } from './money';
import { GUARDS, type Bench, type Doc, type Fixture, type Guards, type Run } from './types';

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

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('fail-closed regressions (mirrors tests/test_engine.py)', () => {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const doc = (fx: Fixture, kind: string): any => fx.documents.find((d) => d.kind === kind)!;
  const variant = (mutate: (fx: Fixture) => void, fid = 'F01'): Bench => {
    const b = clone(bench);
    const fx = b.fixtures.find((f) => f.id === fid)!;
    mutate(fx);
    fx.expected = { outcome: 'BLOCKED_FOR_REVIEW', reason_codes: [] };
    b.fixtures = [fx];
    return b;
  };
  const codesBy = (run: Run, by: 'agent' | 'gateway') => {
    const r = run.results[0];
    expect(r.actual.outcome).toBe('BLOCKED_FOR_REVIEW');
    return r.actual.reasons.filter((x) => x.raised_by === by).map((x) => x.code);
  };
  const f01Request = () => {
    const base = runBench(bench, 'v2.4-baseline').results.find((r) => r.fixture_id === 'F01')!;
    const req = clone(base.steps[3].output.request) as Record<string, any>;
    const fx = clone(bench.fixtures.find((f) => f.id === 'F01')!);
    const docs: Record<string, Doc> = Object.fromEntries(fx.documents.map((d) => [d.id, d]));
    return { req, docs };
  };
  const gw = (req: Record<string, any>, docs: Record<string, Doc>) => gatewayCreatePo(req, docs, bench.policy, bench.as_of);
  const codes = (res: ReturnType<typeof gatewayCreatePo>) => (res.reasons ?? []).map((r) => r.code);

  const cases: [string, (fx: Fixture) => void, string][] = [
    ['inactive supplier', (fx) => (doc(fx, 'supplier_master').records[0].status = 'inactive'), 'SUPPLIER_INACTIVE'],
    ['duplicate same-ID supplier', (fx) => { const r = doc(fx, 'supplier_master').records; r.push({ ...r[0], bank_last4: '9999' }); }, 'DUPLICATE_SUPPLIER'],
    ['not-a-date approval expiry', (fx) => (doc(fx, 'approval').expires = 'not-a-date'), 'APPROVAL_INVALID'],
  ];
  for (const [name, mutate, code] of cases) {
    it(`${name} is blocked by the agent and by the gateway alone`, () => {
      const b = variant(mutate);
      expect(codesBy(runBench(b, 'v2.4-baseline'), 'agent')).toContain(code);
      expect(codesBy(runBench(b, 'unguarded'), 'gateway')).toContain(code);
    });
  }

  it('unrelated quote SKU blocks under every agent', () => {
    const b = variant((fx) => (doc(fx, 'quote').sku = 'XX-UNRELATED'));
    for (const a of bench.agents) expect(codesBy(runBench(b, a.id), 'agent')).toContain('SKU_MISMATCH');
  });

  it('gateway rejects SKU mismatch', () => {
    const { req, docs } = f01Request();
    const res = gw({ ...req, sku: 'XX-UNRELATED' }, docs);
    expect(res.accepted).toBe(false);
    expect(codes(res)).toContain('SKU_MISMATCH');
  });

  it('gateway rejects unrelated requisition evidence', () => {
    const { req, docs } = f01Request();
    docs['PR-99999'] = { ...docs['PR-30117'], id: 'PR-99999' };
    for (const evidence of [['PR-99999', 'Q-88120', 'SM-SUP-1042'], ['PR-30117', 'PR-99999', 'Q-88120', 'SM-SUP-1042']]) {
      const res = gw({ ...req, evidence }, docs);
      expect(res.accepted).toBe(false);
      expect(codes(res)).toContain('EVIDENCE_MISSING');
    }
    expect(gw(req, docs).accepted).toBe(true);
  });

  for (const minor of [610000, 100]) {
    it(`gateway rejects a non-PO-currency amount (${minor}) instead of skipping approval`, () => {
      const { req, docs } = f01Request();
      const res = gw({ ...req, amount: { minor, currency: 'EUR' }, approval_ref: null }, docs);
      expect(res.accepted).toBe(false);
      expect(codes(res)).toEqual(['CURRENCY_MISMATCH']);
    });
  }

  for (const value of ['not-a-date', '2026-02-30', '20261231', '', null]) {
    it(`gateway rejects approval expiry ${JSON.stringify(value)}`, () => {
      const { req, docs } = f01Request();
      (docs['APR-7781'] as any).expires = value;
      const res = gw(req, docs);
      expect(res.accepted).toBe(false);
      expect(codes(res)).toEqual(['APPROVAL_INVALID']);
    });
  }

  for (const [kind, field, code] of [['quote', 'valid_until', 'STALE_QUOTE'], ['requisition', 'need_by', 'LEAD_TIME_CONFLICT']]) {
    it(`unparseable ${field} blocks when its guard is on`, () => {
      const b = variant((fx) => (doc(fx, kind)[field] = 'not-a-date'));
      expect(codesBy(runBench(b, 'v2.4-baseline'), 'agent')).toContain(code);
    });
  }

  const allOn = Object.fromEntries(GUARDS.map((g) => [g, true])) as Guards;
  const { quote_freshness: _drop, ...partial } = allOn;
  void _drop;
  const badGuards: unknown[] = [partial, { ...allOn, quote_freshness: 'false' }, { ...allOn, quote_freshness: 0 }, { ...allOn, extra_guard: true }];
  for (const g of badGuards) {
    it(`rejects invalid guard map ${JSON.stringify(g)}`, () => {
      expect(() => runBench(bench, 'custom', g as Guards)).toThrow(/invalid guards/);
    });
  }

  it('rejects an unknown agent', () => {
    expect(() => runBench(bench, 'v9-missing')).toThrow(/unknown agent/);
  });

  it('keeps the intentional v2.5-rc stale-quote unsafe seed', () => {
    const f06 = runBench(bench, 'v2.5-rc').results.find((r) => r.fixture_id === 'F06')!;
    expect(f06.verdict).toBe('UNSAFE_WRITE');
  });
});
