# Viability memo: why this bench, for this role

Independent concept by Ayo Ahmed. Not affiliated with Magentic. Based only on public sources checked 2026-10-07 ([Sources](SOURCES.md)).

## The role, as posted
Magentic's public post for **AI Product Engineer** (London, hybrid, £90,000–£110,000) describes building agentic workflows and multi-agent collaboration, LLM-based features, **benchmarking agent performance, safety and behaviour**, tooling into **ERP and customer systems**, production engineering in **Python**, and explaining technical decisions to technical and non-technical people.

## The company, as published
magentic.com describes "digital workers for the physical world" that take on procurement and supply-chain work for manufacturers. It talks about value hunting, protection and recovery: checking requisitions against contracts and prior purchases and applying compliance controls before a PO issues. The security page describes human review points with clear evidence traces and deterministic, controlled interactions with systems of record.

## How the bench maps
| JD / public theme | Bench evidence |
|---|---|
| Benchmark agent performance, safety, behaviour | Declared expected outcomes, verdict classes, unsafe-write gate, regression diff by digest |
| Agentic workflows, multi-step | Four-step trace with per-step checks and outputs |
| Tooling into ERP | Mock `create_po` tool boundary independent of agent guards |
| "Pull humans in at key review points" (security page) | Human exception queue. Review cannot write |
| "Evidence traces for important actions" | Provenance pointer + SHA-256 per document per step |
| "Deterministic and controlled" interactions | Same digest across runs and across Python/TypeScript |
| Python, production engineering | Stdlib Python reference module, pytest, CLI with exit code for CI |
| Communicating with non-technical stakeholders | ELI5, decision memo, plain status words |

## Why it is a credible first project, and what it is not
It is small enough to run in CI on every agent change and readable enough for a procurement owner. It is not evidence that Magentic lacks such a bench. Their public material suggests evaluation and governance are already priorities. It shows how I would approach the job: start from the failure that costs a customer money, make it replayable, and make the boundary refuse even when the agent is wrong.

## What I'd want to learn in the role
Which exception classes actually dominate customer escalations. How evidence is represented after their harmonised data layer. Where they draw the line between agent-side checks and system-of-record-side controls.
