-- One reviewed fixed HTML source. Run once after deploying the matching adapter.
-- Idempotent: existing source state/cursors/leases are never reset.
INSERT INTO sources(id,agency,url,terms_url,commercial,reproduction,modification,automated_access,third_party,api_format,attribution,reviewed_at,enabled,interval_seconds,next_attempt)
VALUES('mhlw-livelihood-index','厚生労働省','https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000059425.html','https://www.mhlw.go.jp/chosakuken/index.html','conditional-PDL1.0','conditional-PDL1.0','conditional-PDL1.0','approved','excluded','html','出典：厚生労働省「生活困窮者自立支援制度」。TODOROKIが事業見出しを抽出・項目整理。政府による判定・推奨ではありません。','2026-11-18',1,86400,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(id) DO NOTHING;
