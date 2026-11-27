#!/usr/bin/env python3
"""Build a private, offline dashboard from the read-only snapshot."""
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "command-center-results"
data = json.loads((OUTPUT / "snapshot.json").read_text(encoding="utf-8"))
rows = []
for task in data["tasks"]:
    status = "TODO完了（本番検証は別）" if task["todo_complete"] else "未完了"
    cells = [task["id"], task["project"], task["title"], status,
             task["implementation"], task["tests"], task["production"], task["public_page"]]
    rows.append("<tr>" + "".join("<td>" + html.escape(str(x)) + "</td>" for x in cells) + "</tr>")
page = """<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TODOROKI 開発司令塔（非公開スナップショット）</title>
<style>body{font:15px system-ui;margin:2rem;background:#111;color:#eee}h1{color:#e5bd64}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #444;padding:.6rem;text-align:left}
section{overflow-x:auto}input{padding:.7rem;width:min(95%,30rem)}small{color:#aaa}</style>
<h1>TODOROKI 統合開発司令塔</h1><p id="summary"></p>
<p><small>GitHub Actionsの非公開Artifact用。実装・テスト・本番・公開確認は証拠未照合のため未確認。</small></p>
<input id="filter" placeholder="課題ID・プロジェクト・内容で絞り込み" aria-label="課題検索">
<section><table><thead><tr><th>ID</th><th>プロジェクト</th><th>課題</th><th>TODO</th><th>実装</th><th>テスト</th><th>本番</th><th>公開確認</th></tr></thead>
<tbody>""" + "\n".join(rows) + """</tbody></table></section>
<script>const q=document.querySelector('#filter');q.addEventListener('input',()=>{const needle=q.value.toLowerCase();
document.querySelectorAll('tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(needle));});</script></html>"""
data_counts = data["counts"]
page = page.replace('<p id="summary"></p>', f'<p id="summary">全{data_counts["total"]}件 / 完了{data_counts["completed"]}件 / 未完了{data_counts["open"]}件</p>')
(OUTPUT / "index.html").write_text(page, encoding="utf-8")
print("Private offline dashboard generated")
