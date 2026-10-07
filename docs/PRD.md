# PRD: Procurement Exception Bench

Independent concept by Ayo Ahmed. Not affiliated with Magentic. Synthetic data only.

## Problem (hypothesis)
Agents that turn purchase requests into purchase orders make decisions where one wrong write is expensive and slow to undo. These include the wrong pack size, a duplicate supplier record with different bank details, an expired price, a currency relabelled as another, or spend above an approval limit. When the agent's prompts, tools or planner change, a team needs a fast, repeatable way to show that none of those decisions got worse. This is a hypothesis drawn from public material about the category (see [Sources](SOURCES.md)). It is not a claim about any company's systems.

## Users
- **Agent / product engineer** changing planner logic, tool schemas or guards, who needs a regression signal before release.
- **Procurement operations lead** who signs off that the agent's write boundary matches policy.
- **Customer-facing engineer** who has to explain to a customer why an action was blocked, with the evidence.

## Goals
1. Every fixture has a declared expected outcome and reason codes. A run is graded automatically.
2. Unsafe writes (written when a block was expected) are the headline failure and fail the CLI with exit code 1.
3. Every step cites the documents it used, down to a pointer and hash.
4. The ERP write boundary is independent of agent guards and is tested in its own right.
5. A run is deterministic: same fixtures + same guards = same digest in Python and in the browser.
6. Output is portable: benchmark JSON and a human-readable decision memo.

## Non-goals
Real ERP or supplier integration, model calls, sourcing optimisation, supplier scoring, and any dashboard of spend analytics.

## Functional requirements
| ID | Requirement | Where |
|---|---|---|
| FR1 | Load fixtures, policy and agent presets from one JSON file | `bench/fixtures.json` |
| FR2 | Four-step trace: retrieve, compare, policy, proposed ERP action | `bench/engine.py`, `src/engine/engine.ts` |
| FR3 | Block when evidence is missing (requisition, quote, supplier record, FX, catalogue) | RET-01, CMP-01, CMP-02, gateway |
| FR4 | Block when approval is absent, mis-scoped, too small or expired | POL-04, gateway |
| FR5 | Six toggleable agent guards. The gateway is not toggleable | UI controls |
| FR6 | Expected vs actual, verdict per fixture | UI trace header, export |
| FR7 | Regression vs baseline digest | UI table, CLI output |
| FR8 | Human exception queue with recorded decisions that never write | UI side panel |
| FR9 | Export benchmark JSON and Markdown decision memo | UI buttons |
| FR10 | Integer minor-unit money with explicit currency and half-even FX | `money.py`, `money.ts` |
| FR11 | Python/TS parity on committed goldens | `engine.test.ts` |
| FR12 | Visible non-affiliation and SIMULATED labels | header, intro, ERP step, footer |

## UX principles
Evidence before verdicts. Plain words for each status ("Guard off", "Unsafe write"). Red only for unsafe outcomes. No dashboard padding: every panel is part of the decision.
