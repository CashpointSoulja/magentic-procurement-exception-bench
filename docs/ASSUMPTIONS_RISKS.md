# Assumptions and risks

Independent concept by Ayo Ahmed. Not affiliated with Magentic.

## Assumptions
| # | Assumption | How to test it |
|---|---|---|
| A1 | Teams building procurement agents change prompts/tools often enough that regressions are a real risk | Count agent changes per week vs exception fixtures added |
| A2 | The costly failures cluster in a small number of classes (units, currency, supplier identity, validity, approval, lead time) | Classify a sample of real blocked/escalated cases |
| A3 | Procurement owners will read a short memo with reason codes more readily than a trace log | Show both to an owner, see which they sign off |
| A4 | Deterministic rule fixtures are useful even when the production agent uses a model | Replay model-generated traces through the same grader (V2) |
| A5 | An approval threshold and scope check is a reasonable minimum write boundary | Compare with real delegation-of-authority policies |

## Risks
| Risk | Effect | Mitigation |
|---|---|---|
| Fixtures overfit to the guards that pass them | False confidence | Fixtures are declared before guards and graded on outcome, not on which rule fired. Add customer-derived cases |
| Synthetic data hides messy real formats (PDF quotes, free-text UOM) | Bench passes, production fails | V2: retrieval fixtures built from real document layouts with redacted values |
| Reviewers treat "Pass" as "safe in production" | Over-trust | SIMULATED labels everywhere, memo states the scope |
| Brand mirror read as an official product | Reputational and legal | Non-affiliation label in header, intro and footer. No customer logos |
| Currency or rounding drift between languages | Wrong amounts in export | Integer money and a parity test on committed goldens |
| Human queue becomes a dumping ground | Review fatigue | False-block metric is tracked next to unsafe writes |
