"""python -m bench [--agent ID] [--out FILE] [--golden]"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import compare_runs, load_bench, run_bench


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="bench")
    p.add_argument("--agent", default="v2.4-baseline")
    p.add_argument("--out")
    p.add_argument("--golden", action="store_true", help="write bench/golden/<agent>.json for every agent")
    a = p.parse_args(argv)
    bench = load_bench()
    if a.golden:
        d = Path(__file__).with_name("golden")
        d.mkdir(exist_ok=True)
        for ag in bench["agents"]:
            run = run_bench(bench, ag["id"])
            (d / f"{ag['id']}.json").write_text(json.dumps(run, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(ag["id"], run["totals"], run["run_digest"][:12])
        return 0
    run = run_bench(bench, a.agent)
    base = run_bench(bench, "v2.4-baseline")
    for row in compare_runs(base, run):
        print(f"{row['fixture_id']}  {row['baseline']:<13} -> {row['candidate']:<13} {row['change']}")
    print("totals", run["totals"], "digest", run["run_digest"][:12])
    if a.out:
        Path(a.out).write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")
    return 1 if run["totals"]["UNSAFE_WRITE"] else 0


if __name__ == "__main__":
    sys.exit(main())
