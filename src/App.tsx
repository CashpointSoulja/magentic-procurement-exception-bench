import { useEffect, useMemo, useRef, useState } from 'react';
import benchJson from '../bench/fixtures.json';
import { BLOCK, compareRuns, runBench, type Change } from './engine/engine';
import { fmt, type Money } from './engine/money';
import { GUARDS, type Bench, type Check, type FixtureResult, type Guard, type Guards, type Step, type Verdict } from './engine/types';
import { benchExport, decisionMemo, REVIEW_LABEL, type Review, type ReviewAction } from './memo';

const bench = benchJson as unknown as Bench;
const BASELINE_ID = 'v2.4-baseline';
const baselineRun = runBench(bench, BASELINE_ID);
const STEP_MS = 260;

const GUARD_LABEL: Record<Guard, string> = {
  unit_consistency: 'Unit / pack-size reconciliation',
  lead_time: 'Lead time vs need-by',
  supplier_dedupe: 'Duplicate supplier check',
  currency_evidence: 'FX evidence for currency',
  quote_freshness: 'Quote freshness',
  approval_check: 'Approval scope and limit',
};
const STEP_LABEL: Record<Step['name'], string> = {
  retrieve: 'Retrieve evidence',
  compare: 'Compare and normalise',
  policy: 'Policy checks',
  erp_action: 'Proposed ERP action',
};
const VERDICT_LABEL: Record<Verdict, string> = { PASS: 'Pass', UNSAFE_WRITE: 'Unsafe write', FALSE_BLOCK: 'False block', WRONG_REASON: 'Wrong reason' };
const outcomeLabel = (o: string) => (o === BLOCK ? 'Blocked for review' : 'PO write allowed');

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}
const verdictTone = (v: Verdict) => (v === 'PASS' ? 'ok' : v === 'UNSAFE_WRITE' ? 'bad' : 'warn');
const outcomeTone = (o: string) => (o === BLOCK ? 'block' : 'write');
const changeTone = (c: Change) => (c === 'REGRESSED' ? 'bad' : c === 'IMPROVED' ? 'ok' : 'muted');

function CheckRow({ c }: { c: Check }) {
  const word = { pass: 'Pass', fail: 'Fail', skipped: 'Guard off', na: 'Not applicable' }[c.result];
  return (
    <li className={`check check-${c.result}`}>
      <span className="dot" aria-hidden="true" />
      <span className="check-main">
        <span className="check-label">
          <span className="mono rule">{c.rule}</span> {c.label}
          <span className="sr-only">: {word}</span>
        </span>
        <span className="check-detail mono">{c.detail}</span>
      </span>
      <span className={`check-word check-word-${c.result}`} aria-hidden="true">
        {word}
      </span>
    </li>
  );
}

function StepOutput({ step }: { step: Step }) {
  const o = step.output as Record<string, unknown>;
  if (step.name === 'compare' && o.line_total) {
    const po = o.po_amount as Money | null;
    return (
      <dl className="kv mono">
        <dt>Packs</dt>
        <dd>
          {String(o.packs)} x {String(o.pack_size)} EA
        </dd>
        <dt>Unit price</dt>
        <dd>{fmt(o.unit_price as Money)}</dd>
        <dt>Line total</dt>
        <dd>{fmt(o.line_total as Money)}</dd>
        <dt>PO amount</dt>
        <dd>{po ? fmt(po) : 'not derivable'}</dd>
      </dl>
    );
  }
  if (step.name === 'erp_action' && 'called' in o) {
    if (!o.called) return <p className="erp-note">Agent did not call <code>create_po</code>. Nothing reached the simulated ERP.</p>;
    return (
      <details className="erp-json" open>
        <summary>Tool call and boundary response (simulated)</summary>
        <pre className="mono">{JSON.stringify({ request: o.request, response: o.response }, null, 2)}</pre>
      </details>
    );
  }
  return null;
}

function Trace({ r }: { r: FixtureResult }) {
  return (
    <ol className="steps">
      {r.steps.map((s, i) => {
        const failed = s.checks.some((c) => c.result === 'fail');
        const skipped = s.checks.some((c) => c.result === 'skipped');
        return (
          <li key={s.name} className={`step ${failed ? 'step-fail' : skipped ? 'step-skip' : 'step-ok'}`}>
            <div className="step-head">
              <span className="step-n mono">0{i + 1}</span>
              <h4>{STEP_LABEL[s.name]}</h4>
              {s.name === 'erp_action' && <Chip tone="sim">Simulated ERP</Chip>}
            </div>
            {s.checks.length === 0 ? <p className="muted">Skipped: required evidence missing.</p> : <ul className="checks">{s.checks.map((c, j) => <CheckRow key={j} c={c} />)}</ul>}
            <StepOutput step={s} />
            {s.provenance.length > 0 && (
              <div className="prov">
                <span className="prov-label mono">Provenance</span>
                <ul>
                  {s.provenance.map((p, j) => (
                    <li key={j} className="mono" title={p.pointer}>
                      {p.doc_id} <span className="muted">sha {p.sha256_12}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function App() {
  const [agentId, setAgentId] = useState(BASELINE_ID);
  const [guards, setGuards] = useState<Guards>(bench.agents[0].guards);
  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [selected, setSelected] = useState('F01');
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [drafts, setDrafts] = useState<Record<string, { action: ReviewAction; note: string }>>({});
  const timer = useRef<number | undefined>(undefined);

  const run = useMemo(() => runBench(bench, agentId, guards), [agentId, guards]);
  const regression = useMemo(() => compareRuns(baselineRun, run), [run]);
  const shown = phase === 'idle' ? 0 : revealed;
  const done = phase === 'done';
  const fixture = bench.fixtures.find((f) => f.id === selected)!;
  const selIndex = bench.fixtures.indexOf(fixture);
  const result = selIndex < shown ? run.results[selIndex] : null;
  const queue = done ? run.results.filter((r) => r.actual.outcome === BLOCK) : [];

  useEffect(() => () => window.clearInterval(timer.current), []);

  function invalidate() {
    window.clearInterval(timer.current);
    setPhase('idle');
    setRevealed(0);
    setReviews({});
  }
  function chooseAgent(id: string) {
    setAgentId(id);
    const a = bench.agents.find((x) => x.id === id);
    if (a) setGuards(a.guards);
    invalidate();
  }
  function toggleGuard(g: Guard) {
    setGuards((cur) => ({ ...cur, [g]: !cur[g] }));
    setAgentId('custom');
    invalidate();
  }
  function start() {
    window.clearInterval(timer.current);
    setReviews({});
    setPhase('running');
    setRevealed(0);
    let n = 0;
    timer.current = window.setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= bench.fixtures.length) {
        window.clearInterval(timer.current);
        setPhase('done');
      }
    }, STEP_MS);
  }
  function reset() {
    setAgentId(BASELINE_ID);
    setGuards(bench.agents[0].guards);
    setSelected('F01');
    setDrafts({});
    invalidate();
  }
  function record(fid: string) {
    const d = drafts[fid] ?? { action: 'KEEP_BLOCKED', note: '' };
    setReviews((cur) => ({ ...cur, [fid]: { action: d.action, note: d.note.trim() } }));
  }
  const exportJson = () => download(`exception-bench-${run.agent_id}-${run.run_digest.slice(0, 8)}.json`, JSON.stringify(benchExport(bench, run, baselineRun, regression, reviews), null, 2) + '\n', 'application/json');
  const exportMemo = () => download(`decision-memo-${run.agent_id}-${run.run_digest.slice(0, 8)}.md`, decisionMemo(bench, run, baselineRun, regression, reviews), 'text/markdown');

  const agent = bench.agents.find((a) => a.id === agentId);
  const status = phase === 'idle' ? 'Not run yet.' : phase === 'running' ? `Replaying fixture ${shown} of ${bench.fixtures.length}…` : `Run complete: ${run.totals.PASS} of ${run.results.length} pass, ${run.totals.UNSAFE_WRITE} unsafe write${run.totals.UNSAFE_WRITE === 1 ? '' : 's'}.`;

  return (
    <>
      <header className="site">
        <div className="site-inner">
          <a className="brand" href="https://www.magentic.com/" rel="noopener noreferrer">
            <img src="./brand/magentic-logo.svg" width="140" height="24" alt="Magentic" />
          </a>
          <span className="product mono">Procurement Exception Bench</span>
          <p className="affil">Independent concept by Ayo Ahmed. Not affiliated with Magentic.</p>
        </div>
      </header>

      <main className="wrap">
        <section className="intro" aria-labelledby="title">
          <div>
            <Chip tone="tag">Synthetic benchmark</Chip>
            <h1 id="title">Replay the supplier decisions a procurement agent must not get wrong.</h1>
          </div>
          <div className="intro-copy">
            <p>
              Eight synthetic purchase requests, each with a known right answer. A mock agent runs <strong>retrieve → compare → policy check → proposed ERP write</strong>. The bench grades every
              trace against what it expected, flags any purchase order written when it should have been blocked, and diffs the run against a baseline so a regression shows up before release.
            </p>
            <p className="simnote">
              <Chip tone="sim">Simulated</Chip> The agent is a fixed rule pipeline, not a model. The ERP is an in-memory mock. Suppliers, quotes, approvals and FX rates are invented. Nothing here is a
              deployed autonomous system.
            </p>
          </div>
        </section>

        <section className="controls" aria-label="Run configuration">
          <fieldset className="agents">
            <legend>Agent under test</legend>
            <div className="seg" role="radiogroup" aria-label="Agent under test">
              {bench.agents.map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={agentId === a.id} className={agentId === a.id ? 'on' : ''} onClick={() => chooseAgent(a.id)}>
                  {a.label}
                </button>
              ))}
              <button type="button" role="radio" aria-checked={agentId === 'custom'} className={agentId === 'custom' ? 'on' : ''} disabled={agentId !== 'custom'}>
                Custom
              </button>
            </div>
            <p className="muted small">{agent ? agent.description : 'Custom guard set. Toggle guards to see which fixtures each one protects.'}</p>
          </fieldset>
          <fieldset className="guards">
            <legend>Agent-side guards</legend>
            <ul>
              {GUARDS.map((g) => (
                <li key={g}>
                  <label>
                    <input type="checkbox" checked={guards[g]} onChange={() => toggleGuard(g)} />
                    <span>{GUARD_LABEL[g]}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="muted small">The ERP tool boundary (evidence + approval) is always on and cannot be toggled.</p>
          </fieldset>
          <div className="actions">
            <button type="button" className="btn" onClick={start} disabled={phase === 'running'}>
              {done ? 'Re-run bench' : 'Run bench'}
            </button>
            <button type="button" className="btn btn-inv" onClick={reset}>
              Reset
            </button>
            <button type="button" className="btn btn-inv" onClick={exportJson} disabled={!done}>
              Export JSON
            </button>
            <button type="button" className="btn btn-inv" onClick={exportMemo} disabled={!done}>
              Decision memo
            </button>
          </div>
        </section>

        <section className="totals" aria-live="polite">
          <p className="status">{status}</p>
          {done && (
            <ul className="scores">
              <li className="score-ok">
                <b>{run.totals.PASS}</b> pass
              </li>
              <li className={run.totals.UNSAFE_WRITE ? 'score-bad' : ''}>
                <b>{run.totals.UNSAFE_WRITE}</b> unsafe writes
              </li>
              <li>
                <b>{run.totals.FALSE_BLOCK}</b> false blocks
              </li>
              <li>
                <b>{run.totals.WRONG_REASON}</b> wrong reason
              </li>
              <li className="mono digest">digest {run.run_digest.slice(0, 12)}</li>
            </ul>
          )}
        </section>

        <div className="bench">
          <section className="panel fixtures" aria-labelledby="fx-h">
            <h2 id="fx-h">Fixtures</h2>
            <ul className="fx-list">
              {bench.fixtures.map((f, i) => {
                const r = i < shown ? run.results[i] : null;
                return (
                  <li key={f.id}>
                    <button type="button" className={`fx ${selected === f.id ? 'sel' : ''} ${r?.verdict === 'UNSAFE_WRITE' ? 'fx-bad' : ''}`} aria-pressed={selected === f.id} onClick={() => setSelected(f.id)}>
                      <span className="fx-top">
                        <span className="mono fx-id">{f.id}</span>
                        <span className="fx-title">{f.title}</span>
                      </span>
                      <span className="fx-chips">
                        <span className="mono small muted">expect</span>
                        <Chip tone={outcomeTone(f.expected.outcome)}>{f.expected.outcome === BLOCK ? 'Block' : 'Write'}</Chip>
                        {r ? <Chip tone={verdictTone(r.verdict)}>{VERDICT_LABEL[r.verdict]}</Chip> : <span className="mono small muted">{phase === 'running' ? 'queued' : 'not run'}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel trace" aria-labelledby="tr-h">
            <div className="trace-head">
              <span className="mono muted">{fixture.id} · trace</span>
              <h2 id="tr-h">{fixture.title}</h2>
              <p>{fixture.summary}</p>
            </div>
            <div className="eva">
              <div>
                <span className="mono small muted">Expected</span>
                <Chip tone={outcomeTone(fixture.expected.outcome)}>{outcomeLabel(fixture.expected.outcome)}</Chip>
                <span className="mono small">{fixture.expected.reason_codes.join(', ') || 'no exceptions'}</span>
              </div>
              <div>
                <span className="mono small muted">Actual</span>
                {result ? (
                  <>
                    <Chip tone={outcomeTone(result.actual.outcome)}>{outcomeLabel(result.actual.outcome)}</Chip>
                    <span className="mono small">{result.actual.reason_codes.join(', ') || 'no exceptions'}</span>
                  </>
                ) : (
                  <span className="mono small muted">run the bench</span>
                )}
              </div>
              <div>
                <span className="mono small muted">Verdict</span>
                {result ? <Chip tone={verdictTone(result.verdict)}>{VERDICT_LABEL[result.verdict]}</Chip> : <span className="mono small muted">–</span>}
              </div>
            </div>
            {result ? <Trace r={result} /> : <p className="empty">Trace appears here after the run. The evidence packet below is what the agent will retrieve.</p>}
            <details className="packet">
              <summary>
                Evidence packet <span className="muted">({fixture.documents.length} synthetic documents)</span>
              </summary>
              <pre className="mono">{JSON.stringify(fixture.documents, null, 2)}</pre>
            </details>
          </section>

          <aside className="side">
            <section className="panel" aria-labelledby="rg-h">
              <h2 id="rg-h">Regression vs {bench.agents[0].label}</h2>
              {done ? (
                <table className="reg">
                  <thead>
                    <tr>
                      <th scope="col">Fixture</th>
                      <th scope="col">Baseline</th>
                      <th scope="col">This run</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regression.map((row) => (
                      <tr key={row.fixture_id} className={row.change === 'REGRESSED' ? 'row-bad' : ''}>
                        <th scope="row" className="mono">
                          {row.fixture_id}
                        </th>
                        <td>{VERDICT_LABEL[row.baseline]}</td>
                        <td>{VERDICT_LABEL[row.candidate]}</td>
                        <td>
                          <Chip tone={changeTone(row.change)}>{row.change.toLowerCase()}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Run the bench to compare against the baseline digest {baselineRun.run_digest.slice(0, 12)}.</p>
              )}
            </section>

            <section className="panel" aria-labelledby="q-h">
              <h2 id="q-h">
                Human exception queue {done && <span className="count mono">{queue.length}</span>}
              </h2>
              {!done && <p className="muted">Blocked fixtures land here for a person to decide.</p>}
              {done && queue.length === 0 && <p className="muted">Empty: nothing was blocked.</p>}
              <ul className="queue">
                {queue.map((r) => {
                  const rv = reviews[r.fixture_id];
                  const d = drafts[r.fixture_id] ?? { action: 'KEEP_BLOCKED' as ReviewAction, note: '' };
                  return (
                    <li key={r.fixture_id} className="q-item">
                      <button type="button" className="q-open" onClick={() => setSelected(r.fixture_id)}>
                        <span className="mono">{r.fixture_id}</span> {r.title}
                      </button>
                      <p className="small">
                        {r.actual.reasons.map((x, i) => (
                          <span key={i} className="q-reason">
                            <Chip tone={x.raised_by === 'gateway' ? 'block' : 'warn'}>{x.code}</Chip> <span className="muted">{x.raised_by === 'gateway' ? 'tool boundary' : 'agent'}:</span> {x.detail}
                          </span>
                        ))}
                      </p>
                      {rv ? (
                        <p className="small reviewed">
                          <Chip tone="ok">Reviewed</Chip> {REVIEW_LABEL[rv.action]}
                          {rv.note && <> · “{rv.note}”</>}
                        </p>
                      ) : (
                        <div className="q-form">
                          <label className="small">
                            <span className="sr-only">Decision for {r.fixture_id}</span>
                            <select value={d.action} onChange={(e) => setDrafts((c) => ({ ...c, [r.fixture_id]: { ...d, action: e.target.value as ReviewAction } }))}>
                              {(Object.keys(REVIEW_LABEL) as ReviewAction[]).map((k) => (
                                <option key={k} value={k}>
                                  {REVIEW_LABEL[k]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="small">
                            <span className="sr-only">Note for {r.fixture_id}</span>
                            <input type="text" placeholder="Reviewer note (optional)" value={d.note} maxLength={140} onChange={(e) => setDrafts((c) => ({ ...c, [r.fixture_id]: { ...d, note: e.target.value } }))} />
                          </label>
                          <button type="button" className="btn btn-sm" onClick={() => record(r.fixture_id)}>
                            Record decision
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {done && queue.length > 0 && <p className="muted small">Decisions go into the memo and export only. No review action can write to the ERP.</p>}
            </section>
          </aside>
        </div>
      </main>

      <footer className="foot">
        <div className="wrap foot-inner">
          <p>Independent concept by Ayo Ahmed. Not affiliated with Magentic. Magentic name and logo belong to their owner and are used only to show the brand mirror.</p>
          <p className="mono small">
            bench {bench.bench_version} · run date {bench.as_of} · fixtures sha {baselineRun.fixtures_sha256.slice(0, 12)} · all data synthetic
          </p>
        </div>
      </footer>
    </>
  );
}
