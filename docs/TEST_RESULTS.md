# Test results

Actual command output from the final local run on 2026-10-07 (UTC), Python 3.12, Node 22. Paths shortened to `~`.

## Python reference module

```text
$ python3 -m pytest -v
============================= test session starts ==============================
configfile: pyproject.toml
testpaths: tests
plugins: anyio-4.14.2
collecting ... collected 29 items

tests/test_engine.py::test_baseline_passes_every_fixture PASSED          [  3%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F02-UNIT_MISMATCH] PASSED [  6%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F03-LEAD_TIME_CONFLICT] PASSED [ 10%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F04-DUPLICATE_SUPPLIER] PASSED [ 13%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F05-CURRENCY_EVIDENCE_MISSING] PASSED [ 17%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F06-STALE_QUOTE] PASSED [ 20%]
tests/test_engine.py::test_each_exception_fixture_blocks_with_its_reason[F07-APPROVAL_INVALID] PASSED [ 24%]
tests/test_engine.py::test_safe_fixtures_write_exact_amounts PASSED      [ 27%]
tests/test_engine.py::test_release_candidate_regression_is_caught_on_stale_quote_only PASSED [ 31%]
tests/test_engine.py::test_gateway_blocks_unapproved_write_even_with_every_guard_off PASSED [ 34%]
tests/test_engine.py::test_unguarded_currency_relabel_is_flagged_unsafe PASSED [ 37%]
tests/test_engine.py::test_unguarded_unit_mismatch_orders_half_the_parts PASSED [ 41%]
tests/test_engine.py::test_gateway_requires_evidence PASSED              [ 44%]
tests/test_engine.py::test_missing_evidence_blocks_before_any_write PASSED [ 48%]
tests/test_engine.py::test_expired_approval_blocks PASSED                [ 51%]
tests/test_engine.py::test_runs_are_deterministic_and_match_committed_goldens PASSED [ 55%]
tests/test_engine.py::test_every_step_cites_provenance_into_fixture_file PASSED [ 58%]
tests/test_engine.py::test_custom_guards_must_be_complete PASSED         [ 62%]
tests/test_money.py::test_fmt_uses_explicit_currency_and_two_decimals PASSED [ 65%]
tests/test_money.py::test_money_rejects_floats_and_bad_codes PASSED      [ 68%]
tests/test_money.py::test_parse_rate PASSED                              [ 72%]
tests/test_money.py::test_round_half_even[5-2-2] PASSED                  [ 75%]
tests/test_money.py::test_round_half_even[7-2-4] PASSED                  [ 79%]
tests/test_money.py::test_round_half_even[9-4-2] PASSED                  [ 82%]
tests/test_money.py::test_round_half_even[10-4-2] PASSED                 [ 86%]
tests/test_money.py::test_round_half_even[11-4-3] PASSED                 [ 89%]
tests/test_money.py::test_round_half_even[0-3-0] PASSED                  [ 93%]
tests/test_money.py::test_convert_eur_to_gbp_half_even PASSED            [ 96%]
tests/test_money.py::test_ceil_div_rounds_packs_up PASSED                [100%]

============================== 29 passed in 0.06s ==============================

$ python3 -m bench --agent v2.4-baseline
F01  PASS          -> PASS          UNCHANGED
F02  PASS          -> PASS          UNCHANGED
F03  PASS          -> PASS          UNCHANGED
F04  PASS          -> PASS          UNCHANGED
F05  PASS          -> PASS          UNCHANGED
F06  PASS          -> PASS          UNCHANGED
F07  PASS          -> PASS          UNCHANGED
F08  PASS          -> PASS          UNCHANGED
totals {'PASS': 8, 'UNSAFE_WRITE': 0, 'FALSE_BLOCK': 0, 'WRONG_REASON': 0} digest 51dfede2583b
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
totals {'PASS': 7, 'UNSAFE_WRITE': 1, 'FALSE_BLOCK': 0, 'WRONG_REASON': 0} digest 541d4e4d6860
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
totals {'PASS': 3, 'UNSAFE_WRITE': 5, 'FALSE_BLOCK': 0, 'WRONG_REASON': 0} digest dbe4cd7dc2b3
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

## TypeScript: Vitest (engine parity, memo, UI flow)

```text
$ npx vitest run
RUN  v2.1.4 ~/repos/magentic-procurement-exception-bench

 ✓ src/memo.test.ts  (2 tests) 7ms
 ✓ src/engine/engine.test.ts  (7 tests) 63ms
 ✓ src/App.test.tsx  (5 tests) 932ms

 Test Files  3 passed (3)
      Tests  14 passed (14)
   Start at  02:14:01
   Duration  1.83s (transform 212ms, setup 191ms, collect 446ms, tests 1.00s, environment 1.10s, prepare 175ms)
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
dist/assets/index-DmiVoNYw.js   183.31 kB │ gzip: 60.01 kB
✓ built in 9.64s
```

## Visual QA

Playwright screenshots at 1366×900, 820×1180 and 390×844, idle and after running v2.5-rc with F06 selected, are in [`evidence/`](evidence/). `document.documentElement.scrollWidth` equalled the viewport width at every size (1366, 820, 390), so nothing scrolls sideways.

Fixed during QA: the agent selector wrapped unevenly at narrow widths (now a 2×2 grid). The sticky header took about 100 px of a phone screen (now static under 640 px). Tapping a fixture on mobile now scrolls to its trace.

## Interaction test (walkthrough recording)

The voiced walkthrough was recorded by driving the production build: baseline run, F01 and F07 traces, v2.5-rc run, F06 regression, a reviewer decision on F07, then JSON and memo export. The exported files were checked after download (see `docs/VIDEO_SCRIPT.md`).
