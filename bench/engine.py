"""Mock four-step agent trace plus an ERP tool boundary, graded against expected outcomes.

Nothing here calls a model, an ERP or a supplier. The "agent" is a fixed rule pipeline whose
guards can be switched off to simulate regressions; the "ERP" is an in-memory gateway.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

from .money import Money, ceil_div, convert, fmt

FIXTURES_PATH = Path(__file__).with_name("fixtures.json")
GUARDS = ("unit_consistency", "lead_time", "supplier_dedupe", "currency_evidence", "quote_freshness", "approval_check")
WRITE, BLOCK = "PO_WRITE_ALLOWED", "BLOCKED_FOR_REVIEW"


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(obj) -> str:
    return hashlib.sha256(canonical(obj).encode("utf-8")).hexdigest()


def load_bench(path: Path = FIXTURES_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def days_between(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def add_days(a: str, n: int) -> str:
    return date.fromordinal(date.fromisoformat(a).toordinal() + n).isoformat()


def check(rule: str, label: str, result: str, detail: str) -> dict:
    return {"rule": rule, "label": label, "result": result, "detail": detail}


def gateway_create_po(request: dict, docs: dict, policy: dict, as_of: str) -> dict:
    """Mock ERP tool boundary. Independent of agent guards: refuses writes without evidence or approval."""
    reasons = []
    cited = request["evidence"]
    missing = [d for d in cited if d not in docs]
    kinds = {docs[d]["kind"] for d in cited if d in docs}
    if missing or not {"requisition", "quote", "supplier_master"} <= kinds:
        reasons.append({"code": "EVIDENCE_MISSING", "detail": "PO request must cite a retrieved requisition, quote and supplier record."})
    amount = Money.from_json(request["amount"])
    threshold = Money.from_json(policy["approval_threshold"])
    if amount.currency == threshold.currency and amount.minor >= threshold.minor:
        ref = request.get("approval_ref")
        apr = docs.get(ref) if ref else None
        if apr is None or apr["kind"] != "approval":
            reasons.append({"code": "APPROVAL_INVALID", "detail": f"{fmt(amount)} is at or above {fmt(threshold)} and no approval was cited."})
        elif apr["scope"] != request["requisition"]:
            reasons.append({"code": "APPROVAL_INVALID", "detail": f"{ref} is scoped to {apr['scope']}, not {request['requisition']}."})
        elif apr["limit"]["currency"] != amount.currency or apr["limit"]["minor"] < amount.minor or apr["expires"] < as_of:
            reasons.append({"code": "APPROVAL_INVALID", "detail": f"{ref} does not cover {fmt(amount)} on {as_of}."})
    if reasons:
        return {"accepted": False, "reasons": reasons}
    return {"accepted": True, "po_number": "SIM-PO-" + sha(request)[:8].upper()}


def run_fixture(fx: dict, fx_index: int, guards: dict, bench: dict) -> dict:
    as_of, policy = bench["as_of"], bench["policy"]
    po_cur = policy["po_currency"]
    docs = {d["id"]: d for d in fx["documents"]}
    by_kind: dict[str, list] = {}
    for d in fx["documents"]:
        by_kind.setdefault(d["kind"], []).append(d)
    first = lambda k: by_kind.get(k, [None])[0]  # noqa: E731
    pr, quote, sm, cat, fxs = first("requisition"), first("quote"), first("supplier_master"), first("catalogue"), first("fx_snapshot")
    approvals = by_kind.get("approval", [])
    reasons: list[dict] = []

    def fail(code: str, step: str, detail: str) -> None:
        reasons.append({"code": code, "raised_by": "agent", "step": step, "detail": detail})

    def prov(doc: dict) -> dict:
        j = fx["documents"].index(doc)
        return {"doc_id": doc["id"], "kind": doc["kind"], "pointer": f"bench/fixtures.json#/fixtures/{fx_index}/documents/{j}", "sha256_12": sha(doc)[:12]}

    # 1. retrieve
    checks = []
    for kind, d in (("requisition", pr), ("quote", quote), ("supplier_master", sm)):
        if d is None:
            checks.append(check("RET-01", f"{kind} retrieved", "fail", "not found in packet"))
            fail("EVIDENCE_MISSING", "retrieve", f"No {kind} document in packet.")
        else:
            checks.append(check("RET-01", f"{kind} retrieved", "pass", d["id"]))
    for kind, d in (("catalogue", cat), ("fx_snapshot", fxs)):
        checks.append(check("RET-02", f"{kind} retrieved", "pass" if d else "na", d["id"] if d else "not in packet"))
    checks.append(check("RET-02", "approval retrieved", "pass" if approvals else "na", ", ".join(a["id"] for a in approvals) or "not in packet"))
    steps = [{"name": "retrieve", "checks": checks, "provenance": [prov(d) for d in fx["documents"]], "output": {"documents": len(fx["documents"])}}]
    if pr is None or quote is None or sm is None:
        steps += [{"name": n, "checks": [], "provenance": [], "output": {}} for n in ("compare", "policy", "erp_action")]
        return finish(fx, steps, reasons, None)

    # 2. compare
    checks, cprov = [], [prov(quote), prov(pr)]
    if quote["unit"] == "EA":
        pack = 1
        checks.append(check("CMP-01", "Quote unit reconciles to requisition UOM", "pass", "quote priced per EA"))
    elif guards["unit_consistency"]:
        if cat is None:
            pack = quote["pack_size"]
            checks.append(check("CMP-01", "Quote unit reconciles to requisition UOM", "fail", f"quote priced per {quote['unit']} of {quote['pack_size']}; no catalogue record to confirm"))
            fail("UNIT_MISMATCH", "compare", "Pack size could not be confirmed.")
        elif cat["pack_size"] != quote["pack_size"]:
            pack = quote["pack_size"]
            cprov.append(prov(cat))
            checks.append(check("CMP-01", "Quote unit reconciles to requisition UOM", "fail", f"quote {quote['id']} says {quote['unit']} = {quote['pack_size']} EA; catalogue {cat['id']} says {cat['pack_size']} EA"))
            fail("UNIT_MISMATCH", "compare", f"Quote pack size {quote['pack_size']} conflicts with catalogue pack size {cat['pack_size']}.")
        else:
            pack = quote["pack_size"]
            cprov.append(prov(cat))
            checks.append(check("CMP-01", "Quote unit reconciles to requisition UOM", "pass", f"{quote['unit']} = {pack} EA in quote and catalogue"))
    else:
        pack = cat["pack_size"] if cat else quote["pack_size"]
        checks.append(check("CMP-01", "Quote unit reconciles to requisition UOM", "skipped", f"guard off: assumed {quote['unit']} = {pack} EA"))
    packs = ceil_div(pr["qty"], pack)
    unit_price = Money.from_json(quote["unit_price"])
    line_total = unit_price.times(packs)
    po_amount: Money | None
    fx_used = None
    if line_total.currency == po_cur:
        po_amount = line_total
        checks.append(check("CMP-02", f"Amount expressed in PO currency ({po_cur})", "pass", f"{fmt(line_total)}"))
    elif fxs and fxs["from"] == line_total.currency and fxs["to"] == po_cur:
        po_amount = convert(line_total, po_cur, fxs["rate"])
        fx_used = fxs["id"]
        cprov.append(prov(fxs))
        checks.append(check("CMP-02", f"Amount expressed in PO currency ({po_cur})", "pass", f"{fmt(line_total)} x {fxs['rate']} ({fxs['id']}) = {fmt(po_amount)}, half-even rounding"))
    elif guards["currency_evidence"]:
        po_amount = None
        checks.append(check("CMP-02", f"Amount expressed in PO currency ({po_cur})", "fail", f"quote in {line_total.currency}, no {line_total.currency}->{po_cur} FX snapshot retrieved"))
        fail("CURRENCY_EVIDENCE_MISSING", "compare", f"Cannot convert {fmt(line_total)} to {po_cur} without a cited rate.")
    else:
        po_amount = Money(line_total.minor, po_cur)
        checks.append(check("CMP-02", f"Amount expressed in PO currency ({po_cur})", "skipped", f"guard off: relabelled {fmt(line_total)} as {fmt(po_amount)}"))
    steps.append({"name": "compare", "checks": checks, "provenance": cprov, "output": {
        "pack_size": pack, "packs": packs, "unit_price": unit_price.to_json(), "line_total": line_total.to_json(),
        "po_amount": po_amount.to_json() if po_amount else None, "fx_used": fx_used}})

    # 3. policy
    checks, pprov = [], [prov(quote), prov(pr)]
    delivery = add_days(as_of, quote["lead_days"])
    if not guards["lead_time"]:
        checks.append(check("POL-01", "Lead time meets need-by date", "skipped", "guard off"))
    elif delivery <= pr["need_by"]:
        checks.append(check("POL-01", "Lead time meets need-by date", "pass", f"{as_of} + {quote['lead_days']}d = {delivery} <= {pr['need_by']}"))
    else:
        late = days_between(pr["need_by"], delivery)
        checks.append(check("POL-01", "Lead time meets need-by date", "fail", f"{as_of} + {quote['lead_days']}d = {delivery}, {late}d after {pr['need_by']}"))
        fail("LEAD_TIME_CONFLICT", "policy", f"Earliest delivery {delivery} is {late} days after need-by {pr['need_by']}.")
    pprov.append(prov(sm))
    rec = next((r for r in sm["records"] if r["supplier_id"] == quote["supplier_id"]), None)
    if not guards["supplier_dedupe"]:
        checks.append(check("POL-02", "Supplier resolves to exactly one active record", "skipped", "guard off"))
    elif rec is None:
        checks.append(check("POL-02", "Supplier resolves to exactly one active record", "fail", f"{quote['supplier_id']} not in supplier master"))
        fail("EVIDENCE_MISSING", "policy", f"Supplier {quote['supplier_id']} has no master record.")
    else:
        twins = [r["supplier_id"] for r in sm["records"] if r["company_no"] == rec["company_no"] and r["status"] == "active" and r["supplier_id"] != rec["supplier_id"]]
        if twins:
            checks.append(check("POL-02", "Supplier resolves to exactly one active record", "fail", f"{rec['supplier_id']} and {', '.join(twins)} share company no. {rec['company_no']} with different bank details"))
            fail("DUPLICATE_SUPPLIER", "policy", f"{rec['supplier_id']} duplicates {', '.join(twins)}.")
        else:
            checks.append(check("POL-02", "Supplier resolves to exactly one active record", "pass", f"{rec['supplier_id']} {rec['name']}"))
    if not guards["quote_freshness"]:
        checks.append(check("POL-03", "Quote valid on run date", "skipped", "guard off"))
    elif quote["valid_until"] >= as_of:
        checks.append(check("POL-03", "Quote valid on run date", "pass", f"valid until {quote['valid_until']}"))
    else:
        age = days_between(quote["valid_until"], as_of)
        checks.append(check("POL-03", "Quote valid on run date", "fail", f"expired {quote['valid_until']}, {age}d before {as_of}"))
        fail("STALE_QUOTE", "policy", f"Quote {quote['id']} expired {age} days ago.")
    threshold = Money.from_json(policy["approval_threshold"])
    approval_ref = approvals[0]["id"] if approvals else None
    if po_amount is None:
        checks.append(check("POL-04", "Approval covers PO amount", "na", "no PO-currency amount to check"))
    elif po_amount.minor < threshold.minor:
        checks.append(check("POL-04", "Approval covers PO amount", "pass", f"{fmt(po_amount)} below {fmt(threshold)} threshold; none required"))
        approval_ref = None
    elif not guards["approval_check"]:
        checks.append(check("POL-04", "Approval covers PO amount", "skipped", f"guard off: will cite {approval_ref or 'nothing'}"))
    else:
        ok = next((a for a in approvals if a["scope"] == pr["id"] and a["limit"]["currency"] == po_amount.currency
                   and a["limit"]["minor"] >= po_amount.minor and a["expires"] >= as_of), None)
        pprov += [prov(a) for a in approvals]
        if ok:
            approval_ref = ok["id"]
            checks.append(check("POL-04", "Approval covers PO amount", "pass", f"{ok['id']} scoped to {pr['id']}, limit {fmt(Money.from_json(ok['limit']))}"))
        else:
            why = "; ".join(f"{a['id']} scoped to {a['scope']}" for a in approvals) or "no approval in packet"
            checks.append(check("POL-04", "Approval covers PO amount", "fail", f"{fmt(po_amount)} needs approval: {why}"))
            fail("APPROVAL_INVALID", "policy", f"No approval scoped to {pr['id']} covers {fmt(po_amount)}.")
    steps.append({"name": "policy", "checks": checks, "provenance": pprov, "output": {"earliest_delivery": delivery, "approval_ref": approval_ref}})

    # 4. proposed ERP action (simulated)
    if reasons:
        steps.append({"name": "erp_action", "checks": [check("ERP-00", "Agent proposes create_po", "fail", "agent withheld the write: open exceptions")],
                      "provenance": [], "output": {"called": False, "request": None, "response": None}})
        return finish(fx, steps, reasons, None)
    request = {"action": "create_po", "requisition": pr["id"], "supplier_id": quote["supplier_id"], "sku": pr["sku"],
               "packs": packs, "pack_size": pack, "amount": po_amount.to_json(),
               "evidence": [pr["id"], quote["id"], sm["id"]] + ([fx_used] if fx_used else []), "approval_ref": approval_ref}
    response = gateway_create_po(request, docs, policy, as_of)
    if response["accepted"]:
        c = check("ERP-01", "Tool boundary accepts write", "pass", f"simulated {response['po_number']} for {fmt(po_amount)}")
    else:
        c = check("ERP-01", "Tool boundary accepts write", "fail", "; ".join(r["detail"] for r in response["reasons"]))
        for r in response["reasons"]:
            reasons.append({"code": r["code"], "raised_by": "gateway", "step": "erp_action", "detail": r["detail"]})
    steps.append({"name": "erp_action", "checks": [check("ERP-00", "Agent proposes create_po", "pass", f"{packs} x {pack} EA, {fmt(po_amount)}"), c],
                  "provenance": [prov(docs[d]) for d in request["evidence"]], "output": {"called": True, "request": request, "response": response}})
    return finish(fx, steps, reasons, response)


def finish(fx: dict, steps: list, reasons: list, response: dict | None) -> dict:
    outcome = WRITE if response and response["accepted"] else BLOCK
    exp = fx["expected"]
    codes = sorted({r["code"] for r in reasons})
    if outcome == exp["outcome"] and set(exp["reason_codes"]) <= set(codes):
        verdict = "PASS"
    elif exp["outcome"] == BLOCK and outcome == WRITE:
        verdict = "UNSAFE_WRITE"
    elif exp["outcome"] == WRITE and outcome == BLOCK:
        verdict = "FALSE_BLOCK"
    else:
        verdict = "WRONG_REASON"
    return {"fixture_id": fx["id"], "title": fx["title"], "expected": exp,
            "actual": {"outcome": outcome, "reason_codes": codes, "reasons": reasons}, "verdict": verdict, "steps": steps}


def run_bench(bench: dict, agent_id: str | None = None, guards: dict | None = None) -> dict:
    if guards is None:
        agent = next(a for a in bench["agents"] if a["id"] == agent_id)
        guards = agent["guards"]
    else:
        agent_id = agent_id or "custom"
    missing = [g for g in GUARDS if g not in guards]
    if missing:
        raise ValueError(f"missing guards: {missing}")
    guards = {g: bool(guards[g]) for g in GUARDS}
    results = [run_fixture(fx, i, guards, bench) for i, fx in enumerate(bench["fixtures"])]
    totals = {v: sum(r["verdict"] == v for r in results) for v in ("PASS", "UNSAFE_WRITE", "FALSE_BLOCK", "WRONG_REASON")}
    body = {"bench_version": bench["bench_version"], "as_of": bench["as_of"], "fixtures_sha256": sha(bench["fixtures"]),
            "agent_id": agent_id, "guards": guards, "totals": totals, "results": results}
    return {**body, "run_digest": sha(body)}


def compare_runs(base: dict, cand: dict) -> list[dict]:
    rank = {"PASS": 0, "WRONG_REASON": 1, "FALSE_BLOCK": 2, "UNSAFE_WRITE": 3}
    rows = []
    for b, c in zip(base["results"], cand["results"]):
        if b["verdict"] == c["verdict"]:
            change = "UNCHANGED"
        elif rank[c["verdict"]] > rank[b["verdict"]]:
            change = "REGRESSED"
        else:
            change = "IMPROVED"
        rows.append({"fixture_id": b["fixture_id"], "baseline": b["verdict"], "candidate": c["verdict"], "change": change})
    return rows
