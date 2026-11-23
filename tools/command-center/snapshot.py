#!/usr/bin/env python3
"""Read-only command center snapshot from the canonical TODO ledger."""
import datetime as dt
import json
import pathlib
import re
from triage import triage

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/TODOROKI-TODO.md"
OUT = ROOT / "command-center-results"
PATTERN = re.compile(r"^- \[([ x])\] (.+?)\s*<!-- todo:(T\d+) project:(.*?) -->", re.M)

def build(text):
    tasks = []
    for match in PATTERN.finditer(text):
        checked, title, task_id, project = match.groups()
        tasks.append({"id": task_id, "project": project, "title": title.strip(),
                      "todo_complete": checked == "x",
                      "implementation": "unverified", "tests": "unverified",
                      "production": "unverified", "public_page": "unverified",
                      "evidence": [], "requires_approval": None})
    if not tasks:
        raise ValueError("No canonical TODO entries found; refusing empty snapshot")
    if len({x["id"] for x in tasks}) != len(tasks):
        raise ValueError("Duplicate TODO IDs")
    return {"schema_version": 1, "source": "docs/TODOROKI-TODO.md",
            "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "counts": {"total": len(tasks), "completed": sum(x["todo_complete"] for x in tasks),
                       "open": sum(not x["todo_complete"] for x in tasks)},
            "tasks": triage({"tasks": tasks})}

if __name__ == "__main__":
    result = build(SOURCE.read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    (OUT / "snapshot.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["counts"], ensure_ascii=False))
