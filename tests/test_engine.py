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


# Fail-closed regressions: each malformed packet must block, and the gateway must block it on its own.

def variant(mutate, fid="F01"):
    b = copy.deepcopy(BENCH)
    fx = next(f for f in b["fixtures"] if f["id"] == fid)
    mutate(fx)
    fx["expected"] = {"outcome": BLOCK, "reason_codes": []}
    b["fixtures"] = [fx]
    return b


def doc(fx, kind):
    return next(d for d in fx["documents"] if d["kind"] == kind)


def f01_request():
    req = copy.deepcopy(result(run_bench(BENCH, "v2.4-baseline"), "F01")["steps"][3]["output"]["request"])
    fx = copy.deepcopy(next(f for f in BENCH["fixtures"] if f["id"] == "F01"))
    return req, {d["id"]: d for d in fx["documents"]}


def codes_by(run, raised_by):
    r = run["results"][0]
    assert r["actual"]["outcome"] == BLOCK
    return {x["code"] for x in r["actual"]["reasons"] if x["raised_by"] == raised_by}


def set_status(fx):
    doc(fx, "supplier_master")["records"][0]["status"] = "inactive"


def dup_same_id(fx):
    recs = doc(fx, "supplier_master")["records"]
    recs.append({**recs[0], "bank_last4": "9999"})


def bad_expiry(fx):
    doc(fx, "approval")["expires"] = "not-a-date"


@pytest.mark.parametrize("mutate,code", [(set_status, "SUPPLIER_INACTIVE"), (dup_same_id, "DUPLICATE_SUPPLIER"), (bad_expiry, "APPROVAL_INVALID")])
def test_malformed_packet_blocked_by_agent_and_by_gateway_alone(mutate, code):
    b = variant(mutate)
    assert code in codes_by(run_bench(b, "v2.4-baseline"), "agent")
    assert code in codes_by(run_bench(b, "unguarded"), "gateway")


@pytest.mark.parametrize("agent", ["v2.4-baseline", "v2.5-rc", "unguarded"])
def test_unrelated_quote_sku_blocks_under_every_agent(agent):
    b = variant(lambda fx: doc(fx, "quote").update(sku="XX-UNRELATED"))
    assert "SKU_MISMATCH" in codes_by(run_bench(b, agent), "agent")


def test_gateway_rejects_sku_mismatch():
    req, docs = f01_request()
    req["sku"] = "XX-UNRELATED"
    res = gateway_create_po(req, docs, BENCH["policy"], BENCH["as_of"])
    assert not res["accepted"] and "SKU_MISMATCH" in {r["code"] for r in res["reasons"]}


def test_gateway_rejects_unrelated_requisition_evidence():
    req, docs = f01_request()
    docs["PR-99999"] = {**docs["PR-30117"], "id": "PR-99999"}
    for evidence in (["PR-99999", "Q-88120", "SM-SUP-1042"], ["PR-30117", "PR-99999", "Q-88120", "SM-SUP-1042"]):
        res = gateway_create_po({**req, "evidence": evidence}, docs, BENCH["policy"], BENCH["as_of"])
        assert not res["accepted"] and "EVIDENCE_MISSING" in {r["code"] for r in res["reasons"]}
    assert gateway_create_po(req, docs, BENCH["policy"], BENCH["as_of"])["accepted"]


@pytest.mark.parametrize("minor", [610000, 100])
def test_gateway_rejects_non_po_currency_instead_of_skipping_approval(minor):
    req, docs = f01_request()
    req.update(amount={"minor": minor, "currency": "EUR"}, approval_ref=None)
    res = gateway_create_po(req, docs, BENCH["policy"], BENCH["as_of"])
    assert not res["accepted"] and [r["code"] for r in res["reasons"]] == ["CURRENCY_MISMATCH"]


@pytest.mark.parametrize("value", ["not-a-date", "2026-02-30", "20261231", "", None])
def test_gateway_rejects_unparseable_approval_expiry(value):
    req, docs = f01_request()
    docs["APR-7781"]["expires"] = value
    res = gateway_create_po(req, docs, BENCH["policy"], BENCH["as_of"])
    assert not res["accepted"] and [r["code"] for r in res["reasons"]] == ["APPROVAL_INVALID"]


@pytest.mark.parametrize("kind,field,code", [("quote", "valid_until", "STALE_QUOTE"), ("requisition", "need_by", "LEAD_TIME_CONFLICT")])
def test_unparseable_dates_block_when_guard_on(kind, field, code):
    b = variant(lambda fx: doc(fx, kind).update({field: "not-a-date"}))
    assert code in codes_by(run_bench(b, "v2.4-baseline"), "agent")


@pytest.mark.parametrize("guards", [
    {g: True for g in GUARDS if g != "quote_freshness"},
    {**ALL_ON, "quote_freshness": "false"},
    {**ALL_ON, "quote_freshness": 0},
    {**ALL_ON, "extra_guard": True},
])
def test_invalid_guard_maps_are_rejected(guards):
    with pytest.raises(ValueError):
        run_bench(BENCH, guards=guards)


def test_unknown_agent_is_rejected():
    with pytest.raises(ValueError):
        run_bench(BENCH, "v9-missing")
