# Five whys

Independent concept by Ayo Ahmed. Not affiliated with Magentic. A reasoning exercise on a hypothetical failure, not a diagnosis of any real system.

**Hypothetical failure:** a release of a procurement agent writes a PO against a quote that expired three months earlier.

1. **Why was the PO written?** The policy step no longer checked quote validity, and the ERP tool accepted the request.
2. **Why did the policy step stop checking?** A refactor moved checks into a new module and the freshness rule was not carried over. Nothing failed because no test exercised an expired quote end to end.
3. **Why did the ERP tool accept it?** The tool boundary checked approval and evidence presence but not freshness. It trusted the agent to have done that.
4. **Why was there no end-to-end test?** Agent tests were written per prompt or per tool, not as replayable cases with declared outcomes. "Looks right" was the bar.
5. **Why were they written that way?** There was no shared, deterministic fixture format with expected outcomes that both engineers and procurement owners could read and sign off.

**Countermeasures shown in this bench:** declared expected outcomes per fixture (F06 is exactly this case), a regression diff against a baseline digest (v2.5-rc shows it), a non-toggleable tool boundary for approval and evidence, and a decision memo a procurement owner can read. The bench also makes the remaining gap visible: freshness is an agent-side guard here, so a V2 item is moving it into the gateway too ([roadmap](ROADMAP_V2.md)).
