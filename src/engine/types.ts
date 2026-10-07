import type { Money } from './money';

export type Outcome = 'PO_WRITE_ALLOWED' | 'BLOCKED_FOR_REVIEW';
export type Verdict = 'PASS' | 'UNSAFE_WRITE' | 'FALSE_BLOCK' | 'WRONG_REASON';
export type CheckResult = 'pass' | 'fail' | 'skipped' | 'na';
export type StepName = 'retrieve' | 'compare' | 'policy' | 'erp_action';
export const GUARDS = ['unit_consistency', 'lead_time', 'supplier_dedupe', 'currency_evidence', 'quote_freshness', 'approval_check'] as const;
export type Guard = (typeof GUARDS)[number];
export type Guards = Record<Guard, boolean>;

export interface Doc {
  id: string;
  kind: string;
  [k: string]: unknown;
}
export interface Fixture {
  id: string;
  title: string;
  summary: string;
  expected: { outcome: Outcome; reason_codes: string[] };
  documents: Doc[];
}
export interface Agent {
  id: string;
  label: string;
  description: string;
  guards: Guards;
}
export interface Bench {
  bench_version: string;
  as_of: string;
  notice: string;
  policy: { po_currency: string; approval_threshold: Money };
  fixtures: Fixture[];
  agents: Agent[];
}
export interface Check {
  rule: string;
  label: string;
  result: CheckResult;
  detail: string;
}
export interface Provenance {
  doc_id: string;
  kind: string;
  pointer: string;
  sha256_12: string;
}
export interface Step {
  name: StepName;
  checks: Check[];
  provenance: Provenance[];
  output: Record<string, unknown>;
}
export interface Reason {
  code: string;
  raised_by: 'agent' | 'gateway';
  step: StepName;
  detail: string;
}
export interface FixtureResult {
  fixture_id: string;
  title: string;
  expected: Fixture['expected'];
  actual: { outcome: Outcome; reason_codes: string[]; reasons: Reason[] };
  verdict: Verdict;
  steps: Step[];
}
export type Totals = Record<Verdict, number>;
export interface Run {
  bench_version: string;
  as_of: string;
  fixtures_sha256: string;
  agent_id: string;
  guards: Guards;
  totals: Totals;
  results: FixtureResult[];
  run_digest: string;
}
export interface GatewayResponse {
  accepted: boolean;
  po_number?: string;
  reasons?: { code: string; detail: string }[];
}
