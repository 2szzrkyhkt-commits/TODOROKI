"""Conservative, fail-closed task triage. No writes or deployments."""
import re

RULES = [
    (1, r"本番障害|データ破損|データ消失|重大障害"),
    (2, r"不具合|エラー|修正|復旧"),
    (3, r"未反映|公開反映|反映"),
    (4, r"欠損|財務|計算"),
    (5, r"検索|広告|収益|GA4|GSC"),
    (6, r"UI|UX|表示|画面"),
]
BLOCKED = re.compile(r"保留|見送り|中止|承認待ち|本人操作|有料|追加費用|契約|課金")
def classify(task):
    if task["todo_complete"]:
        return {"priority": None, "execution": "excluded_completed", "reason": "TODO already checked"}
    title = task["title"]
    priority = next((n for n, pattern in RULES if re.search(pattern, title, re.I)), 7)
    # Text classification alone is never proof of safe automation.
    reason = "Potential owner approval or explicit hold" if BLOCKED.search(title) else "Requires evidence-based eligibility review"
    return {"priority": priority, "execution": "review_required", "reason": reason}

def triage(snapshot):
    items = [{**task, "triage": classify(task)} for task in snapshot["tasks"]]
    items.sort(key=lambda x: (x["triage"]["priority"] is None, x["triage"]["priority"] or 99, x["id"]))
    return items
