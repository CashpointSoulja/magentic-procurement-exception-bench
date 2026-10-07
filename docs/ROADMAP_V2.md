# V2 roadmap

Independent concept by Ayo Ahmed. Not affiliated with Magentic.

1. **Move freshness and currency checks into the tool boundary.** Today they are agent-side only, which is exactly why v2.5-rc leaks F06. Defence in depth for anything that changes money.
2. **Grade recorded traces, not just the mock agent.** Accept a trace file from any agent (rule-based or model-based) in the same schema and grade it, so the bench evaluates the real planner.
3. **Multi-line requisitions and competing quotes.** Add choice: the agent must pick, and the bench checks it picked the cheapest *compliant* option, not the cheapest.
4. **Partial and split approvals.** Delegation-of-authority tables, approval chains, spend split across POs to stay under a threshold.
5. **Fixture authoring from redacted cases.** A form that turns an escalated case into a fixture with an expected outcome, reviewed by a procurement owner.
6. **CI integration.** GitHub Action that runs `python -m bench` on every PR and posts the memo.
7. **Persisted review log.** Reviewer decisions stored with identity and time, fed back as new fixtures.
8. **Severity weighting.** Weight unsafe writes by amount at risk (integer minor units) so a GBP 48,000 leak outranks a GBP 30 one.
