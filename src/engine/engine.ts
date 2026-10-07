// Port of bench/engine.py. Parity with the Python goldens is enforced in engine.test.ts.
import { canonical, sha } from './canonical';
import { ceilDiv, convert, fmt, money, times, type Money } from './money';
import {
  GUARDS,
  type Bench,
  type Check,
  type CheckResult,
  type Doc,
  type Fixture,
  type FixtureResult,
  type GatewayResponse,
  type Guards,
  type Provenance,
  type Reason,
  type Run,
  type Step,
  type StepName,
  type Verdict,
} from './types';

export const WRITE = 'PO_WRITE_ALLOWED';
export const BLOCK = 'BLOCKED_FOR_REVIEW';

export const isIsoDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const toOrdinal = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
export const daysBetween = (a: string, b: string) => toOrdinal(b) - toOrdinal(a);
export const addDays = (a: string, n: number) => new Date((toOrdinal(a) + n) * 86400000).toISOString().slice(0, 10);

const check = (rule: string, label: string, result: CheckResult, detail: string): Check => ({ rule, label, result, detail });
const m = (d: unknown) => money((d as Money).minor, (d as Money).currency);

interface Approval extends Doc {
  scope: string;
  limit: Money;
  expires: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function gatewayCreatePo(request: Record<string, any>, docs: Record<string, Doc>, policy: Bench['policy'], asOf: string): GatewayResponse {
  const reasons: { code: string; detail: string }[] = [];
  const no = (code: string, detail: string) => reasons.push({ code, detail });
  let cited: string[] = request.evidence;
  if (!Array.isArray(cited) || cited.some((d) => !(d in docs))) {
    cited = [];
    no('EVIDENCE_MISSING', 'PO request cites documents that were not retrieved.');
  }
  const citedKind = (k: string): any[] => cited.map((d) => docs[d]).filter((d) => d.kind === k);
  const prs = citedKind('requisition');
  const quotes = citedKind('quote');
  const sms = citedKind('supplier_master');
  if (prs.length !== 1 || quotes.length !== 1 || sms.length !== 1) {
    no('EVIDENCE_MISSING', 'PO request must cite exactly one retrieved requisition, quote and supplier record.');
  } else {
    const [pr, quote, sm] = [prs[0], quotes[0], sms[0]];
    if (pr.id !== request.requisition) no('EVIDENCE_MISSING', `Cited requisition ${pr.id} is not the PO requisition ${request.requisition}.`);
    if (!(quote.sku === pr.sku && pr.sku === request.sku)) {
      no('SKU_MISMATCH', `Quote SKU ${quote.sku}, requisition SKU ${pr.sku} and PO SKU ${request.sku} must match.`);
    }
    if (quote.supplier_id !== request.supplier_id) no('EVIDENCE_MISSING', `Quote ${quote.id} is from ${quote.supplier_id}, not ${request.supplier_id}.`);
    const recs = (sm.records ?? []).filter((r: any) => r.supplier_id === request.supplier_id);
    if (!recs.length) no('EVIDENCE_MISSING', `Supplier ${request.supplier_id} is not in ${sm.id}.`);
    else if (recs.length > 1) no('DUPLICATE_SUPPLIER', `Supplier ${request.supplier_id} has ${recs.length} records in ${sm.id}.`);
    else if (recs[0].status !== 'active') no('SUPPLIER_INACTIVE', `Supplier ${request.supplier_id} is ${recs[0].status}, not active.`);
  }
  const amount = m(request.amount);
  const threshold = m(policy.approval_threshold);
  if (amount.currency !== policy.po_currency || amount.currency !== threshold.currency) {
    no('CURRENCY_MISMATCH', `PO amount ${fmt(amount)} must be in ${policy.po_currency} to be checked against ${fmt(threshold)}.`);
  } else if (amount.minor >= threshold.minor) {
    const ref = request.approval_ref as string | null;
    const apr = (ref ? docs[ref] : undefined) as Approval | undefined;
    if (!apr || apr.kind !== 'approval') {
      no('APPROVAL_INVALID', `${fmt(amount)} is at or above ${fmt(threshold)} and no approval was cited.`);
    } else if (apr.scope !== request.requisition) {
      no('APPROVAL_INVALID', `${ref} is scoped to ${apr.scope}, not ${request.requisition}.`);
    } else if (!isIsoDate(apr.expires)) {
      no('APPROVAL_INVALID', `${ref} expiry ${pyRepr(apr.expires)} is not a valid date.`);
    } else if (apr.limit.currency !== amount.currency || apr.limit.minor < amount.minor || apr.expires < asOf) {
      no('APPROVAL_INVALID', `${ref} does not cover ${fmt(amount)} on ${asOf}.`);
    }
  }
  if (reasons.length) return { accepted: false, reasons };
  return { accepted: true, po_number: 'SIM-PO-' + sha(request).slice(0, 8).toUpperCase() };
}

// Matches Python's repr() for the values shown in check details.
const pyRepr = (v: unknown) => (typeof v === 'string' ? `'${v}'` : v === undefined || v === null ? 'None' : String(v));

export function runFixture(fx: Fixture, fxIndex: number, guards: Guards, bench: Bench): FixtureResult {
  const asOf = bench.as_of;
  const policy = bench.policy;
  const poCur = policy.po_currency;
  const docs: Record<string, Doc> = Object.fromEntries(fx.documents.map((d) => [d.id, d]));
  const byKind: Record<string, any[]> = {};
  for (const d of fx.documents) (byKind[d.kind] ??= []).push(d);
  const first = (k: string): any => byKind[k]?.[0] ?? null;
  const pr = first('requisition');
  const quote = first('quote');
  const sm = first('supplier_master');
  const cat = first('catalogue');
  const fxs = first('fx_snapshot');
  const approvals: Approval[] = byKind.approval ?? [];
  const reasons: Reason[] = [];
  const fail = (code: string, step: StepName, detail: string) => reasons.push({ code, raised_by: 'agent', step, detail });
  const prov = (doc: Doc): Provenance => ({
    doc_id: doc.id,
    kind: doc.kind,
    pointer: `bench/fixtures.json#/fixtures/${fxIndex}/documents/${fx.documents.indexOf(doc)}`,
    sha256_12: sha(doc).slice(0, 12),
  });

  // 1. retrieve
  let checks: Check[] = [];
  for (const [kind, d] of [['requisition', pr], ['quote', quote], ['supplier_master', sm]] as const) {
    if (d === null) {
      checks.push(check('RET-01', `${kind} retrieved`, 'fail', 'not found in packet'));
      fail('EVIDENCE_MISSING', 'retrieve', `No ${kind} document in packet.`);
    } else checks.push(check('RET-01', `${kind} retrieved`, 'pass', d.id));
  }
  for (const [kind, d] of [['catalogue', cat], ['fx_snapshot', fxs]] as const) {
    checks.push(check('RET-02', `${kind} retrieved`, d ? 'pass' : 'na', d ? d.id : 'not in packet'));
  }
  checks.push(check('RET-02', 'approval retrieved', approvals.length ? 'pass' : 'na', approvals.map((a) => a.id).join(', ') || 'not in packet'));
  const steps: Step[] = [{ name: 'retrieve', checks, provenance: fx.documents.map(prov), output: { documents: fx.documents.length } }];
  if (pr === null || quote === null || sm === null) {
    for (const n of ['compare', 'policy', 'erp_action'] as const) steps.push({ name: n, checks: [], provenance: [], output: {} });
    return finish(fx, steps, reasons, null);
  }

  // 2. compare
  checks = [];
  const cprov = [prov(quote), prov(pr)];
  const skus = new Set([quote.sku, pr.sku, ...(cat ? [cat.sku] : [])]);
  const L0 = 'Quote SKU matches requisition';
  if (skus.size === 1) checks.push(check('CMP-00', L0, 'pass', pr.sku));
  else {
    checks.push(check('CMP-00', L0, 'fail', `requisition ${pr.sku}, quote ${quote.sku}` + (cat ? `, catalogue ${cat.sku}` : '')));
    fail('SKU_MISMATCH', 'compare', `Quote ${quote.id} is for ${quote.sku}, not requisition SKU ${pr.sku}.`);
  }
  const L1 = 'Quote unit reconciles to requisition UOM';
  let pack: number;
  if (quote.unit === 'EA') {
    pack = 1;
    checks.push(check('CMP-01', L1, 'pass', 'quote priced per EA'));
  } else if (guards.unit_consistency) {
    pack = quote.pack_size;
    if (cat === null) {
      checks.push(check('CMP-01', L1, 'fail', `quote priced per ${quote.unit} of ${quote.pack_size}; no catalogue record to confirm`));
      fail('UNIT_MISMATCH', 'compare', 'Pack size could not be confirmed.');
    } else if (cat.pack_size !== quote.pack_size) {
      cprov.push(prov(cat));
      checks.push(check('CMP-01', L1, 'fail', `quote ${quote.id} says ${quote.unit} = ${quote.pack_size} EA; catalogue ${cat.id} says ${cat.pack_size} EA`));
      fail('UNIT_MISMATCH', 'compare', `Quote pack size ${quote.pack_size} conflicts with catalogue pack size ${cat.pack_size}.`);
    } else {
      cprov.push(prov(cat));
      checks.push(check('CMP-01', L1, 'pass', `${quote.unit} = ${pack} EA in quote and catalogue`));
    }
  } else {
    pack = cat ? cat.pack_size : quote.pack_size;
    checks.push(check('CMP-01', L1, 'skipped', `guard off: assumed ${quote.unit} = ${pack} EA`));
  }
  const packs = ceilDiv(pr.qty, pack);
  const unitPrice = m(quote.unit_price);
  const lineTotal = times(unitPrice, packs);
  const L2 = `Amount expressed in PO currency (${poCur})`;
  let poAmount: Money | null;
  let fxUsed: string | null = null;
  if (lineTotal.currency === poCur) {
    poAmount = lineTotal;
    checks.push(check('CMP-02', L2, 'pass', fmt(lineTotal)));
  } else if (fxs && fxs.from === lineTotal.currency && fxs.to === poCur) {
    poAmount = convert(lineTotal, poCur, fxs.rate);
    fxUsed = fxs.id;
    cprov.push(prov(fxs));
    checks.push(check('CMP-02', L2, 'pass', `${fmt(lineTotal)} x ${fxs.rate} (${fxs.id}) = ${fmt(poAmount)}, half-even rounding`));
  } else if (guards.currency_evidence) {
    poAmount = null;
    checks.push(check('CMP-02', L2, 'fail', `quote in ${lineTotal.currency}, no ${lineTotal.currency}->${poCur} FX snapshot retrieved`));
    fail('CURRENCY_EVIDENCE_MISSING', 'compare', `Cannot convert ${fmt(lineTotal)} to ${poCur} without a cited rate.`);
  } else {
    poAmount = money(lineTotal.minor, poCur);
    checks.push(check('CMP-02', L2, 'skipped', `guard off: relabelled ${fmt(lineTotal)} as ${fmt(poAmount)}`));
  }
  steps.push({
    name: 'compare',
    checks,
    provenance: cprov,
    output: { pack_size: pack, packs, unit_price: unitPrice, line_total: lineTotal, po_amount: poAmount, fx_used: fxUsed },
  });

  // 3. policy
  checks = [];
  const pprov = [prov(quote), prov(pr)];
  const delivery = addDays(asOf, quote.lead_days);
  const P1 = 'Lead time meets need-by date';
  if (!guards.lead_time) checks.push(check('POL-01', P1, 'skipped', 'guard off'));
  else if (!isIsoDate(pr.need_by)) {
    checks.push(check('POL-01', P1, 'fail', `need-by ${pyRepr(pr.need_by)} is not a valid date`));
    fail('LEAD_TIME_CONFLICT', 'policy', `Need-by date ${pyRepr(pr.need_by)} cannot be checked.`);
  }
  else if (delivery <= pr.need_by) checks.push(check('POL-01', P1, 'pass', `${asOf} + ${quote.lead_days}d = ${delivery} <= ${pr.need_by}`));
  else {
    const late = daysBetween(pr.need_by, delivery);
    checks.push(check('POL-01', P1, 'fail', `${asOf} + ${quote.lead_days}d = ${delivery}, ${late}d after ${pr.need_by}`));
    fail('LEAD_TIME_CONFLICT', 'policy', `Earliest delivery ${delivery} is ${late} days after need-by ${pr.need_by}.`);
  }
  pprov.push(prov(sm));
  const P2 = 'Supplier resolves to exactly one active record';
  const sameId = sm.records.filter((r: any) => r.supplier_id === quote.supplier_id);
  const rec = sameId[0] ?? null;
  if (!guards.supplier_dedupe) checks.push(check('POL-02', P2, 'skipped', 'guard off'));
  else if (rec === null) {
    checks.push(check('POL-02', P2, 'fail', `${quote.supplier_id} not in supplier master`));
    fail('EVIDENCE_MISSING', 'policy', `Supplier ${quote.supplier_id} has no master record.`);
  } else if (sameId.length > 1) {
    checks.push(check('POL-02', P2, 'fail', `${rec.supplier_id} appears ${sameId.length} times in ${sm.id}`));
    fail('DUPLICATE_SUPPLIER', 'policy', `${rec.supplier_id} has ${sameId.length} supplier master records.`);
  } else if (rec.status !== 'active') {
    checks.push(check('POL-02', P2, 'fail', `${rec.supplier_id} status is ${rec.status ?? 'None'}`));
    fail('SUPPLIER_INACTIVE', 'policy', `Supplier ${rec.supplier_id} is not active.`);
  } else {
    const twins = sm.records
      .filter((r: any) => r.company_no === rec.company_no && r.status === 'active' && r.supplier_id !== rec.supplier_id)
      .map((r: any) => r.supplier_id)
      .join(', ');
    if (twins) {
      checks.push(check('POL-02', P2, 'fail', `${rec.supplier_id} and ${twins} share company no. ${rec.company_no} with different bank details`));
      fail('DUPLICATE_SUPPLIER', 'policy', `${rec.supplier_id} duplicates ${twins}.`);
    } else checks.push(check('POL-02', P2, 'pass', `${rec.supplier_id} ${rec.name}`));
  }
  const P3 = 'Quote valid on run date';
  if (!guards.quote_freshness) checks.push(check('POL-03', P3, 'skipped', 'guard off'));
  else if (!isIsoDate(quote.valid_until)) {
    checks.push(check('POL-03', P3, 'fail', `valid until ${pyRepr(quote.valid_until)} is not a valid date`));
    fail('STALE_QUOTE', 'policy', `Quote ${quote.id} validity cannot be checked.`);
  }
  else if (quote.valid_until >= asOf) checks.push(check('POL-03', P3, 'pass', `valid until ${quote.valid_until}`));
  else {
    const age = daysBetween(quote.valid_until, asOf);
    checks.push(check('POL-03', P3, 'fail', `expired ${quote.valid_until}, ${age}d before ${asOf}`));
    fail('STALE_QUOTE', 'policy', `Quote ${quote.id} expired ${age} days ago.`);
  }
  const P4 = 'Approval covers PO amount';
  const threshold = m(policy.approval_threshold);
  let approvalRef: string | null = approvals.length ? approvals[0].id : null;
  if (poAmount === null) checks.push(check('POL-04', P4, 'na', 'no PO-currency amount to check'));
  else if (poAmount.currency === threshold.currency && poAmount.minor < threshold.minor) {
    checks.push(check('POL-04', P4, 'pass', `${fmt(poAmount)} below ${fmt(threshold)} threshold; none required`));
    approvalRef = null;
  } else if (!guards.approval_check) checks.push(check('POL-04', P4, 'skipped', `guard off: will cite ${approvalRef ?? 'nothing'}`));
  else {
    const amt = poAmount;
    const ok = approvals.find((a) => a.scope === pr.id && a.limit.currency === amt.currency && a.limit.minor >= amt.minor && isIsoDate(a.expires) && a.expires >= asOf);
    pprov.push(...approvals.map(prov));
    if (ok) {
      approvalRef = ok.id;
      checks.push(check('POL-04', P4, 'pass', `${ok.id} scoped to ${pr.id}, limit ${fmt(m(ok.limit))}`));
    } else {
      const why = approvals.map((a) => `${a.id} scoped to ${a.scope}`).join('; ') || 'no approval in packet';
      checks.push(check('POL-04', P4, 'fail', `${fmt(amt)} needs approval: ${why}`));
      fail('APPROVAL_INVALID', 'policy', `No approval scoped to ${pr.id} covers ${fmt(amt)}.`);
    }
  }
  steps.push({ name: 'policy', checks, provenance: pprov, output: { earliest_delivery: delivery, approval_ref: approvalRef } });

  // 4. proposed ERP action (simulated)
  if (reasons.length) {
    steps.push({
      name: 'erp_action',
      checks: [check('ERP-00', 'Agent proposes create_po', 'fail', 'agent withheld the write: open exceptions')],
      provenance: [],
      output: { called: false, request: null, response: null },
    });
    return finish(fx, steps, reasons, null);
  }
  const amount = poAmount as Money;
  const request = {
    action: 'create_po',
    requisition: pr.id,
    supplier_id: quote.supplier_id,
    sku: pr.sku,
    packs,
    pack_size: pack,
    amount,
    evidence: [pr.id, quote.id, sm.id, ...(fxUsed ? [fxUsed] : [])],
    approval_ref: approvalRef,
  };
  const response = gatewayCreatePo(request, docs, policy, asOf);
  const c = response.accepted
    ? check('ERP-01', 'Tool boundary accepts write', 'pass', `simulated ${response.po_number} for ${fmt(amount)}`)
    : check('ERP-01', 'Tool boundary accepts write', 'fail', response.reasons!.map((r) => r.detail).join('; '));
  for (const r of response.reasons ?? []) reasons.push({ code: r.code, raised_by: 'gateway', step: 'erp_action', detail: r.detail });
  steps.push({
    name: 'erp_action',
    checks: [check('ERP-00', 'Agent proposes create_po', 'pass', `${packs} x ${pack} EA, ${fmt(amount)}`), c],
    provenance: request.evidence.map((d) => prov(docs[d])),
    output: { called: true, request, response },
  });
  return finish(fx, steps, reasons, response);
}

function finish(fx: Fixture, steps: Step[], reasons: Reason[], response: GatewayResponse | null): FixtureResult {
  const outcome = response?.accepted ? WRITE : BLOCK;
  const exp = fx.expected;
  const codes = [...new Set(reasons.map((r) => r.code))].sort();
  let verdict: Verdict;
  if (outcome === exp.outcome && exp.reason_codes.every((c) => codes.includes(c))) verdict = 'PASS';
  else if (exp.outcome === BLOCK && outcome === WRITE) verdict = 'UNSAFE_WRITE';
  else if (exp.outcome === WRITE && outcome === BLOCK) verdict = 'FALSE_BLOCK';
  else verdict = 'WRONG_REASON';
  return { fixture_id: fx.id, title: fx.title, expected: exp, actual: { outcome, reason_codes: codes, reasons }, verdict, steps };
}

export function runBench(bench: Bench, agentId: string, guardsIn?: Guards): Run {
  if (!isIsoDate(bench.as_of)) throw new Error(`as_of ${bench.as_of} is not a valid date`);
  const g = guardsIn ?? bench.agents.find((a) => a.id === agentId)?.guards;
  if (!g) throw new Error(`unknown agent ${agentId}`);
  const guards = validateGuards(g);
  const results = bench.fixtures.map((fx, i) => runFixture(fx, i, guards, bench));
  const totals = { PASS: 0, UNSAFE_WRITE: 0, FALSE_BLOCK: 0, WRONG_REASON: 0 };
  for (const r of results) totals[r.verdict] += 1;
  const body = { bench_version: bench.bench_version, as_of: bench.as_of, fixtures_sha256: sha(bench.fixtures), agent_id: agentId, guards, totals, results };
  // round-trip so key order and nulls match the JSON the Python module writes
  const plain = JSON.parse(canonical(body)) as Omit<Run, 'run_digest'>;
  return { ...plain, run_digest: sha(plain) };
}

// Every guard must be given explicitly as a boolean; anything else is rejected rather than defaulted.
export function validateGuards(g: unknown): Guards {
  if (typeof g !== 'object' || g === null || Array.isArray(g)) throw new Error('guards must be an object');
  const o = g as Record<string, unknown>;
  const missing = GUARDS.filter((k) => !(k in o));
  const unknown = Object.keys(o).filter((k) => !(GUARDS as readonly string[]).includes(k));
  const bad = GUARDS.filter((k) => k in o && typeof o[k] !== 'boolean');
  if (missing.length || unknown.length || bad.length) {
    throw new Error(`invalid guards: missing [${missing}], unknown [${unknown}], non-boolean [${bad}]`);
  }
  return Object.fromEntries(GUARDS.map((k) => [k, o[k]])) as Guards;
}

export type Change = 'UNCHANGED' | 'REGRESSED' | 'IMPROVED';
export interface CompareRow {
  fixture_id: string;
  baseline: Verdict;
  candidate: Verdict;
  change: Change;
}
const rank: Record<Verdict, number> = { PASS: 0, WRONG_REASON: 1, FALSE_BLOCK: 2, UNSAFE_WRITE: 3 };
export function compareRuns(base: Run, cand: Run): CompareRow[] {
  return base.results.map((b, i) => {
    const c = cand.results[i];
    const change: Change = b.verdict === c.verdict ? 'UNCHANGED' : rank[c.verdict] > rank[b.verdict] ? 'REGRESSED' : 'IMPROVED';
    return { fixture_id: b.fixture_id, baseline: b.verdict, candidate: c.verdict, change };
  });
}
