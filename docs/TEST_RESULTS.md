# Test results

Actual command output from the final local run on 2026-10-07 (UTC), Python 3.10, Node 22. Paths shortened to `~`.

## Fail-closed audit fixes

Each item below has a matching regression test in both `tests/test_engine.py` and `src/engine/engine.test.ts`. Against the previous engine, 20 of the new Python tests failed. They all pass now. The intentional v2.5-rc stale-quote seed (F06) is still an unsafe write, and the bench totals are unchanged.

| Finding | Fix (agent and gateway) | New reason code |
|---|---|---|
| Inactive supplier wrote | POL-02 requires `status: active`; the gateway checks the cited supplier record itself | `SUPPLIER_INACTIVE` |
| Two records with the same supplier ID wrote | POL-02 and the gateway require exactly one record for the ID | `DUPLICATE_SUPPLIER` |
| Quote for an unrelated SKU wrote | CMP-00 (always on) checks quote, requisition and catalogue SKUs match; the gateway checks quote = requisition = PO SKU | `SKU_MISMATCH` |
| Gateway accepted evidence from an unrelated requisition | Gateway requires exactly one cited requisition, quote and supplier record, and the requisition must be the PO's | `EVIDENCE_MISSING` |
| A non-PO currency skipped the approval check | Gateway rejects any amount not in the PO/threshold currency; the agent only treats an amount as under the threshold when the currencies match | `CURRENCY_MISMATCH` |
| An expiry that was not a date passed (string comparison) | Strict `YYYY-MM-DD` calendar parsing for approval expiry (agent and gateway), quote validity and need-by; unparseable dates block | `APPROVAL_INVALID`, `STALE_QUOTE`, `LEAD_TIME_CONFLICT` |
| TypeScript treated missing guards as off; Python raised | Both reject guard maps with missing, unknown or non-boolean values, and unknown agents | (throws) |

## Python reference module

```text
$ python3 -m pytest -v
============================= test session starts ==============================
configfile: pyproject.toml
testpaths: tests
plugins: anyio-4.14.2
collecting ... collected 51 items

tests/test_engine.py::test_baseline_passes_every_fixture PASSED          [  1%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F02-UNIT_MISMATCH] PASSED [  3%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F03-LEAD_TIME_CONFLICT] PASSED [  5%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F04-DUPLICATE_SUPPLIER] PASSED [  7%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F05-CURRENCY_EVIDENCE_MISSING] PASSED [  9%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F06-STALE_QUOTE] PASSED [ 11%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F07-APPROVAL_INVALID] PASSED [ 13%]
tests/test_engine.py::test_safe_fixtures_write_exact_amounts PASSED      [ 15%]
tests/test_engine.py::test_release_candidate_regression_is_caught_on_stale_quote_only PASSED [ 17%]
tests/test_engine.py::test_gateway_blocks_unapproved_write_even_with_every_guard_off PASSED [ 19%]
tests/test_engine.py::test_unguarded_currency_relabel_is_flagged_unsafe PASSED [ 21%]
tests/test_engine.py::test_unguarded_unit_mismatch_orders_half_the_parts PASSED [ 23%]
tests/test_engine.py::test_gateway_requires_evidence PASSED              [ 25%]
tests/test_engine.py::test_missing_evidence_blocks_before_any_write PASSED [ 27%]
tests/test_engine.py::test_expired_approval_blocks PASSED                [ 29%]
tests/test_engine.py::test_runs_are_deterministic_and_match_committed_goldens PASSED [ 31%]
tests/test_engine.py::test_every_step_cites_provenance_into_fixture_file PASSED [ 33%]
tests/test_engine.py::test_custom_guards_must_be_complete PASSED         [ 35%]
tests/test_engine.py::test_malformed_packet_blocked_by_agent_and_by_gateway_alone[set_status-SUPPLIER_INACTIVE] PASSED [ 37%]
tests/test_engine.py::test_malformed_packet_blocked_by_agent_and_by_gateway_alone[dup_same_id-DUPLICATE_SUPPLIER] PASSED [ 39%]
tests/test_engine.py::test_malformed_packet_blocked_by_agent_and_by_gateway_alone[bad_expiry-APPROVAL_INVALID] PASSED [ 41%]
tests/test_engine.py::test_unrelated_quote_sku_blocks_under_every_agent[v2.4-baseline] PASSED [ 43%]
tests/test_engine.py::test_unrelated_quote_sku_blocks_under_every_agent[v2.5-rc] PASSED [ 45%]
tests/test_engine.py::test_unrelated_quote_sku_blocks_under_every_agent[unguarded] PASSED [ 47%]
tests/test_engine.py::test_gateway_rejects_sku_mismatch PASSED           [ 49%]
tests/test_engine.py::test_gateway_rejects_unrelated_requisition_evidence PASSED [ 50%]
tests/test_engine.py::test_gateway_rejects_non_po_currency_instead_of_skipping_approval[610000] PASSED [ 52%]
tests/test_engine.py::test_gateway_rejects_non_po_currency_instead_of_skipping_approval[100] PASSED [ 54%]
tests/test_engine.py::test_gateway_rejects_unparseable_approval_expiry[not-a-date] PASSED [ 56%]
tests/test_engine.py::test_gateway_rejects_unparseable_approval_expiry[2026-02-30] PASSED [ 58%]
tests/test_engine.py::test_gateway_rejects_unparseable_approval_expiry[20261231] PASSED [ 60%]
tests/test_engine.py::test_gateway_rejects_unparseable_approval_expiry[] PASSED [ 62%]
tests/test_engine.py::test_gateway_rejects_unparseable_approval_expiry[None] PASSED [ 64%]
tests/test_engine.py::test_unparseable_dates_block_when_guard_on[quote-valid_until-STALE_QUOTE] PASSED [ 66%]
tests/test_engine.py::test_unparseable_dates_block_when_guard_on[requisition-need_by-LEAD_TIME_CONFLICT] PASSED [ 68%]
tests/test_engine.py::test_invalid_guard_maps_are_rejected[guards0] PASSED [ 70%]
tests/test_engine.py::test_invalid_guard_maps_are_rejected[guards1] PASSED [ 72%]
tests/test_engine.py::test_invalid_guard_maps_are_rejected[guards2] PASSED [ 74%]
tests/test_engine.py::test_invalid_guard_maps_are_rejected[guards3] PASSED [ 76%]
tests/test_engine.py::test_unknown_agent_is_rejected PASSED              [ 78%]
tests/test_money.py::test_fmt_uses_explicit_currency_and_two_decimals PASSED [ 80%]
tests/test_money.py::test_money_rejects_floats_and_bad_codes PASSED      [ 82%]
tests/test_money.py::test_parse_rate PASSED                              [ 84%]
tests/test_money.py::test_round_half_even[5-2-2] PASSED                  [ 86%]
tests/test_money.py::test_round_half_even[7-2-4] PASSED                  [ 88%]
tests/test_money.py::test_round_half_even[9-4-2] PASSED                  [ 90%]
tests/test_money.py::test_round_half_even[10-4-2] PASSED                 [ 92%]
tests/test_money.py::test_round_half_even[11-4-3] PASSED                 [ 94%]
tests/test_money.py::test_round_half_even[0-3-0] PASSED                  [ 96%]
tests/test_money.py::test_convert_eur_to_gbp_half_even PASSED            [ 98%]
tests/test_money.py::test_ceil_div_rounds_packs_up PASSED                [100%]

============================== 51 passed in 0.10s ==============================

$ python3 -m bench --agent v2.4-baseline
F01  PASS          -> PASS          UNCHANGED
F02  PASS          -> PASS          UNCHANGED
F03  PASS          -> PASS          UNCHANGED
F04  PASS          -> PASS          UNCHANGED
F05  PASS          -> PASS          UNCHANGED
F06  PASS          -> PASS          UNCHANGED
F07  PASS          -> PASS          UNCHANGED
F08  PASS          -> PASS          UNCHANGED
totals {'PASS': 8, 'UNSAFE_WRITE': 0, 'FALSE_BLOCK': 0, 'WRONG_REASON': 0} digest 3f66e312106f
exit code: 0

$ python3 -m bench --agent v2.5-rc
F01  PASS          -> PASS          UNCHANGED
F02  PASS          -> PASS          UNCHANGED
F03  PASS          -> PASS          UNCHANGED
F04  PASS          -> PASS          UNCHANGED
F05  PASS          -> PASS          UNCHANGED
F06  PASS          -> UNSAFE_WRITE  REGRESSED
F07  PASS          -> PASS          UNCHANGED
F08  PASS          -> PASS          UNCHANGED
totals {'PASS': 7, 'UNSAFE_WRITE': 1, 'FALSE_BLOCK': 0, 'WRONG_REASON': 0} digest 17589e77ca38
exit code: 1

$ python3 -m bench --agent unguarded
F01  PASS          -> PASS          UNCHANGED
F02  PASS          -> UNSAFE_WRITE  REGRESSED
F03  PASS          -> UNSAFE_WRITE  REGRESSED
F04  PASS          -> UNSAFE_WRITE  REGRESSED
F05  PASS          -> UNSAFE_WRITE  REGRESSED
F06  PASS          -> UNSAFE_WRITE  REGRESSED
F07  PASS          -> PASS          UNCHANGED
F08  PASS          -> PASS          UNCHANGED
totals {'PASS': 3, 'UNSAFE_WRITE': 5, 'FALSE_BLOCK': 0, 'WRONG_REASON': 0} digest 21da26838f7c
exit code: 1
```

`unguarded` exits 1 on purpose: the CLI fails whenever a run contains an unsafe simulated write, so it can gate CI.

## TypeScript: typecheck, lint

```text
$ npx tsc -b
typecheck ok (no errors)
$ npx eslint .
lint ok (0 problems)
```

## TypeScript: Vitest (engine parity, fail-closed regressions, memo, UI flow)

```text
$ npx vitest run --reporter=verbose
 RUN  v2.1.4 ~/repos/magentic-procurement-exception-bench
 ✓ src/memo.test.ts > decision memo > recommends not promoting the regressed candidate and names the unsafe write
 ✓ src/memo.test.ts > decision memo > marks the baseline eligible and exports the full run
 ✓ src/engine/engine.test.ts > parity with the Python evaluation module > v2.4-baseline matches bench/golden/v2.4-baseline.json exactly
 ✓ src/engine/engine.test.ts > parity with the Python evaluation module > v2.5-rc matches bench/golden/v2.5-rc.json exactly
 ✓ src/engine/engine.test.ts > parity with the Python evaluation module > unguarded matches bench/golden/unguarded.json exactly
 ✓ src/engine/engine.test.ts > money > converts with half-even rounding on integer minor units
 ✓ src/engine/engine.test.ts > money > formats with explicit currency
 ✓ src/engine/engine.test.ts > money > rejects non-integer minor units
 ✓ src/engine/engine.test.ts > regression comparison > flags only F06 when the freshness guard is dropped
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > inactive supplier is blocked by the agent and by the gateway alone
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > duplicate same-ID supplier is blocked by the agent and by the gateway alone
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > not-a-date approval expiry is blocked by the agent and by the gateway alone
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > unrelated quote SKU blocks under every agent
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects SKU mismatch
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects unrelated requisition evidence
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects a non-PO-currency amount (610000) instead of skipping approval
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects a non-PO-currency amount (100) instead of skipping approval
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects approval expiry "not-a-date"
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects approval expiry "2026-02-30"
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects approval expiry "20261231"
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects approval expiry ""
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > gateway rejects approval expiry null
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > unparseable valid_until blocks when its guard is on
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > unparseable need_by blocks when its guard is on
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > rejects invalid guard map {"unit_consistency":true,"lead_time":true,"supplier_dedupe":true,"currency_evidence":true,"approval_check":true}
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > rejects invalid guard map {"unit_consistency":true,"lead_time":true,"supplier_dedupe":true,"currency_evidence":true,"quote_freshness":"false","approval_check":true}
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > rejects invalid guard map {"unit_consistency":true,"lead_time":true,"supplier_dedupe":true,"currency_evidence":true,"quote_freshness":0,"approval_check":true}
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > rejects invalid guard map {"unit_consistency":true,"lead_time":true,"supplier_dedupe":true,"currency_evidence":true,"quote_freshness":true,"approval_check":true,"extra_guard":true}
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > rejects an unknown agent
 ✓ src/engine/engine.test.ts > fail-closed regressions (mirrors tests/test_engine.py) > keeps the intentional v2.5-rc stale-quote unsafe seed
 ✓ src/App.test.tsx > bench UI flow > runs baseline, shows all pass and a populated human queue
 ✓ src/App.test.tsx > bench UI flow > catches the release-candidate regression on the stale quote
 ✓ src/App.test.tsx > bench UI flow > toggling a guard switches to custom and invalidates the run; reset restores baseline
 ✓ src/App.test.tsx > bench UI flow > records a reviewer decision without changing the outcome
 ✓ src/App.test.tsx > exports > downloads JSON and memo with the run digest in the file name
 Test Files  3 passed (3)
      Tests  35 passed (35)
   Start at  04:53:33
   Duration  1.53s (transform 191ms, setup 161ms, collect 396ms, tests 879ms, environment 932ms, prepare 158ms)
```

## Production build

```text
$ npm run build
> magentic-procurement-exception-bench@1.0.0 build
> tsc -b && vite build

vite v5.4.10 building for production...
transforming...
✓ 42 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.04 kB │ gzip:  0.54 kB
dist/assets/index-DUZMP_R7.css    9.74 kB │ gzip:  2.85 kB
dist/assets/index-CpnAgFzW.js   186.18 kB │ gzip: 60.87 kB
✓ built in 9.29s
```

## Visual QA

Playwright screenshots at 1366×900, 820×1180 and 390×844, idle and after running v2.5-rc with F06 selected, are in [`evidence/`](evidence/). `document.documentElement.scrollWidth` equalled the viewport width at every size (1366, 820, 390), so nothing scrolls sideways.

Fixed during QA: the agent selector wrapped unevenly at narrow widths (now a 2×2 grid). The sticky header took about 100 px of a phone screen (now static under 640 px). Tapping a fixture on mobile now scrolls to its trace.

## Interaction test (walkthrough recording)

The voiced walkthrough was recorded by driving the production build: baseline run, F01 and F07 traces, v2.5-rc run, F06 regression, a reviewer decision on F07, then JSON and memo export. The exported files were checked after download (see `docs/VIDEO_SCRIPT.md`).
