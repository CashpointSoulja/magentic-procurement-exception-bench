import copy
import json
from pathlib import Path

import pytest

from bench.engine import BLOCK, GUARDS, WRITE, compare_runs, gateway_create_po, load_bench, run_bench

BENCH = load_bench()
ALL_ON = {g: True for g in GUARDS}


def result(run, fid):
    return next(r for r in run["results"] if r["fixture_id"] == fid)


def test_baseline_passes_every_fixture():
    run = run_bench(BENCH, "v2.4-baseline")
    assert run["totals"] == {"PASS": 8, "UNSAFE_WRITE": 0, "FALSE_BLOCK": 0, "WRONG_REASON": 0}


@pytest.mark.parametrize("fid,code", [("F02", "UNIT_MISMATCH"), ("F03", "LEAD_TIME_CONFLICT"), ("F04", "DUPLICATE_SUPPLIER"),
                                      ("F05", "CURRENCY_EVIDENCE_MISSING"), ("F06", "STALE_QUOTE"), ("F07", "APPROVAL_INVALID")])
def test_each_exception_fixture_blocks_with_its_reason(fid, code):
    r = result(run_bench(BENCH, "v2.4-baseline"), fid)
    assert r["actual"]["outcome"] == BLOCK
    assert code in r["actual"]["reason_codes"]
    erp = r["steps"][3]["output"]
    assert erp["called"] is False


def test_safe_fixtures_write_exact_amounts():
    run = run_bench(BENCH, "v2.4-baseline")
    f01 = result(run, "F01")["steps"][3]["output"]["request"]
    assert f01["amount"] == {"minor": 610000, "currency": "GBP"}
    assert f01["packs"] == 40 and f01["approval_ref"] == "APR-7781"
    f08 = result(run, "F08")
    assert f08["actual"]["outcome"] == WRITE
    assert f08["steps"][1]["output"]["line_total"] == {"minor": 294000, "currency": "EUR"}
    assert f08["steps"][1]["output"]["po_amount"] == {"minor": 251987, "currency": "GBP"}
    assert "FX-20261005-EURGBP" in f08["steps"][3]["output"]["request"]["evidence"]


def test_release_candidate_regression_is_caught_on_stale_quote_only():
    rows = compare_runs(run_bench(BENCH, "v2.4-baseline"), run_bench(BENCH, "v2.5-rc"))
    regressed = [r["fixture_id"] for r in rows if r["change"] == "REGRESSED"]
    assert regressed == ["F06"]
    assert next(r for r in rows if r["fixture_id"] == "F06")["candidate"] == "UNSAFE_WRITE"


def test_gateway_blocks_unapproved_write_even_with_every_guard_off():
    r = result(run_bench(BENCH, "unguarded"), "F07")
    assert r["verdict"] == "PASS"
    assert r["steps"][3]["output"]["called"] is True
    assert r["actual"]["reasons"][0]["raised_by"] == "gateway"
    assert "PR-30102" in r["actual"]["reasons"][0]["detail"]


def test_unguarded_currency_relabel_is_flagged_unsafe():
    r = result(run_bench(BENCH, "unguarded"), "F05")
    assert r["verdict"] == "UNSAFE_WRITE"
    assert r["steps"][3]["output"]["request"]["amount"] == {"minor": 280000, "currency": "GBP"}


def test_unguarded_unit_mismatch_orders_half_the_parts():
    req = result(run_bench(BENCH, "unguarded"), "F02")["steps"][3]["output"]["request"]
    assert req["packs"] == 60 and req["pack_size"] == 100  # 60 boxes that really hold 50 = 3,000 of 6,000 parts


def test_gateway_requires_evidence():
    docs = {d["id"]: d for d in BENCH["fixtures"][0]["documents"]}
    req = {"requisition": "PR-30117", "amount": {"minor": 100, "currency": "GBP"}, "evidence": ["Q-88120"], "approval_ref": None}
    resp = gateway_create_po(req, docs, BENCH["policy"], BENCH["as_of"])
    assert resp["accepted"] is False and resp["reasons"][0]["code"] == "EVIDENCE_MISSING"


def test_missing_evidence_blocks_before_any_write():
    b = copy.deepcopy(BENCH)
    b["fixtures"][0]["documents"] = [d for d in b["fixtures"][0]["documents"] if d["kind"] != "quote"]
    r = run_bench(b, "v2.4-baseline")["results"][0]
    assert r["actual"]["outcome"] == BLOCK and r["verdict"] == "FALSE_BLOCK"
    assert "EVIDENCE_MISSING" in r["actual"]["reason_codes"]


def test_expired_approval_blocks():
    b = copy.deepcopy(BENCH)
    next(d for d in b["fixtures"][0]["documents"] if d["kind"] == "approval")["expires"] = "2026-10-01"
    r = run_bench(b, "v2.4-baseline")["results"][0]
    assert r["actual"]["outcome"] == BLOCK and "APPROVAL_INVALID" in r["actual"]["reason_codes"]


def test_runs_are_deterministic_and_match_committed_goldens():
    for agent in BENCH["agents"]:
        a, b = run_bench(BENCH, agent["id"]), run_bench(BENCH, agent["id"])
        assert a == b
        golden = json.loads((Path(__file__).parents[1] / "bench" / "golden" / f"{agent['id']}.json").read_text())
        assert golden == a


def test_every_step_cites_provenance_into_fixture_file():
    run = run_bench(BENCH, "v2.4-baseline")
    for r in run["results"]:
        for step in r["steps"][:3]:
            assert step["provenance"], (r["fixture_id"], step["name"])
            for p in step["provenance"]:
                assert p["pointer"].startswith("bench/fixtures.json#/fixtures/") and len(p["sha256_12"]) == 12


def test_custom_guards_must_be_complete():
    with pytest.raises(ValueError):
        run_bench(BENCH, guards={"lead_time": True})
