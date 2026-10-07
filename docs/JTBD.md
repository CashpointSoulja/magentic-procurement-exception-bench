# Jobs to be done

Independent concept by Ayo Ahmed. Not affiliated with Magentic.

1. **When I change the agent's planner or a tool schema, I want to replay known-hard procurement cases, so I can show nothing that used to be blocked is now written.**
   Served by: agent presets, guard toggles, regression table, CLI exit code.
2. **When an action is blocked, I want to see which document and which rule caused it, so I can fix the data or the rule rather than guess.**
   Served by: per-check detail, rule IDs, provenance pointers with hashes, evidence packet viewer.
3. **When the agent is unsure, I want the case routed to a person with the reasons attached, so the agent never resolves ambiguity by writing.**
   Served by: human exception queue, recorded decisions that cannot write.
4. **When I report to a customer or a release reviewer, I want one file that states what ran, against what, and with what result, so the decision can be audited later.**
   Served by: benchmark JSON with run digest and fixtures hash, decision memo.
5. **When money crosses currencies or units, I want every number derived with stated units and rounding, so a reviewer can recompute it by hand.**
   Served by: integer minor units, explicit rate citation, half-even rounding tests.
