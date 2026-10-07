# Procurement Exception Bench

Independent concept by Ayo Ahmed. Not affiliated with Magentic.

A deterministic, synthetic benchmark that replays procurement-agent traces and checks one thing above all: **an agent must not write a purchase order the evidence does not support.**

## In 30 seconds

Procurement agents read requisitions, quotes and supplier records, compare them, check policy and then propose a write to the ERP. A wrong write costs a manufacturer real money. It can order half the parts, pay a duplicate supplier, or commit spend nobody approved. This bench holds eight synthetic purchase requests with known right answers. It replays a mock agent through retrieve → compare → policy check → proposed ERP write, grades each trace against what was expected, and diffs the run against a baseline, so a release that quietly drops a safety check fails before it ships. A customer would care because it turns "we think the agent is safe" into a repeatable, exportable result that someone can check.

## ELI5

Imagine a robot that buys bolts for a factory. Before it presses "buy" it should check four things: is the price for the right box size, will the bolts arrive in time, is this the real shop and not a copy, and did a grown-up say yes. This bench is a practice exam for the robot. Every question has a known answer. If the robot presses "buy" when it should have stopped and asked a person, the exam marks it red.

## What it does

| Area | What you see |
|---|---|
| Seed | 8 fixtures in `bench/fixtures.json`: safe validated option, quote/unit mismatch, lead-time conflict, duplicate supplier IDs, currency mismatch, stale quote, attempted unapproved PO write, safe EUR quote with FX evidence |
| Agent under test | Three presets (v2.4 baseline, v2.5 release candidate with a simulated regression, unguarded planner) plus six toggleable agent-side guards |
| Trace | Four steps per fixture, each with rule IDs, pass/fail/guard-off results, computed values and per-document provenance (fixture pointer + SHA-256 prefix) |
| Tool boundary | A mock `create_po` gateway that is always on. It refuses writes that lack cited evidence or a valid approval, whatever the agent's guards say |
| Grading | Expected vs actual outcome and reason codes, with each fixture graded `PASS`, `UNSAFE_WRITE`, `FALSE_BLOCK` or `WRONG_REASON` |
| Regression | Per-fixture diff against the v2.4 baseline run digest |
| Human queue | Every blocked fixture, with reasons and who raised them (agent or tool boundary). A reviewer decision is recorded but can never write to the ERP |
| Export | Benchmark JSON (full run, digest, regression, reviews) and a Markdown decision memo |

## What is synthetic or simulated

Everything. The suppliers, company numbers, quotes, requisitions, approvals and the EUR→GBP rate are all invented. The "agent" is a fixed rule pipeline, not a language model, and the "ERP" is an in-memory function. Nothing is fetched or called and no data leaves the browser. This is a **simulated orchestration**, not a deployed autonomous system.

## Money

All amounts are integer minor units with an explicit ISO currency (`{"minor": 610000, "currency": "GBP"}`). FX rates are decimal strings converted with integer arithmetic and half-even rounding (Python `int`, TypeScript `BigInt`). No floats appear in money paths.

## Architecture

```
bench/fixtures.json        synthetic fixtures, policy, agent presets (single source of truth)
bench/engine.py            reference evaluation module (Python 3.10+, stdlib only)
bench/money.py             integer money + FX
bench/golden/*.json        committed Python outputs for each agent preset
tests/                     pytest suite
src/engine/*.ts            browser port of the engine
src/engine/engine.test.ts  parity: TS output must equal the Python goldens byte-for-byte (same run digest)
src/App.tsx                bench UI
```

## Run it

```bash
# Python reference module
python3 -m pip install pytest==8.3.3
python3 -m pytest -q
python3 -m bench --agent v2.5-rc        # exits 1 when any unsafe write is found
python3 -m bench --golden               # regenerate goldens after a fixture change

# Browser app
npm ci
npm test
npm run build && npm run preview
```

## Docs

[Design and brand](docs/DESIGN.md) · [Brand guide](docs/brand/brand-guide.html) · [PRD](docs/PRD.md) · [JTBD](docs/JTBD.md) · [Five whys](docs/FIVE_WHYS.md) · [Metrics](docs/METRICS.md) · [Assumptions and risks](docs/ASSUMPTIONS_RISKS.md) · [Viability memo](docs/VIABILITY_MEMO.md) · [Test plan](docs/TEST_PLAN.md) · [Test results](docs/TEST_RESULTS.md) · [V2 roadmap](docs/ROADMAP_V2.md) · [Sources](docs/SOURCES.md) · [Walkthrough script](docs/VIDEO_SCRIPT.md)

## Known limits

- Eight fixtures, one line per requisition, one quote per fixture. A real bench needs multi-line requisitions, competing quotes and partial approvals.
- The guards are rules written for these fixtures. The bench shows the method and does not claim coverage of real procurement failure modes.
- Reviewer decisions live in browser memory and are lost on reload, apart from the export.
- The Magentic name and logo belong to Magentic and appear only to show the brand mirror for an application.

Author: Ayo Ahmed.
