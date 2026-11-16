export const conditionDocuments = [
  {
    "schemaVersion": 1,
    "programId": "jp-child-allowance",
    "version": "2026-11-16.1",
    "name": "児童手当",
    "scope": "current_catalog_only",
    "effectiveFrom": "2024-10-01",
    "effectiveTo": null,
    "sourceCheckedOn": "2026-11-16",
    "verification": "source_checked_not_adjudicated",
    "attribution": "こども家庭庁の公式案内・Q&AをもとにTODOROKIが条件項目へ編集。法令はe-Gov参照。",
    "termsUrl": "https://www.cfa.go.jp/copyright-policy",
    "notices": [
      "条件データの構造化。個人の受給可否・支給額・開始月を確定する判定エンジンではありません。",
      "自治体・所属庁の認定と例外確認が必要です。未入力・未確認はfalseへ変換しません。",
      "全国の他制度・自治体独自給付は未収録。資料確認日以降の改正を自動適用しません。"
    ],
    "sources": [
      {
        "id": "guide",
        "url": "https://www.cfa.go.jp/policies/kokoseido/jidouteate/annai",
        "section": "支給対象・制度ルール・認定請求",
        "checkedOn": "2026-11-16",
        "checkedAt": "2026-11-16T11:05:00.054929Z",
        "sha256": "a14fe7f49417399a5ca3309939870a5083ce8cf9abd5de24b1c15e62d0ff9722"
      },
      {
        "id": "faq",
        "url": "https://www.cfa.go.jp/policies/kokoseido/jidouteate/faq/ippan/",
        "section": "Q8–10、Q12、申請手続",
        "checkedOn": "2026-11-16",
        "checkedAt": "2026-11-16T11:05:07.332253Z",
        "sha256": "87299236bbb7cc1f21cbde49dcd0d696aa0e346410730f990aa0bac574da2a41"
      },
      {
        "id": "reform",
        "url": "https://lifedesign-information.cfa.go.jp/support-system/support-system02/",
        "section": "所得制限",
        "checkedOn": "2026-11-16",
        "checkedAt": "2026-11-16T11:05:14.506098Z",
        "sha256": "7a6dffc8035bd0f1b28f2f633471549842c054fb68d76bbfa5084d7902dfbace"
      },
      {
        "id": "law",
        "url": "https://laws.e-gov.go.jp/api/2/law_data/346AC0000000073",
        "section": "第4条",
        "checkedOn": "2026-11-16",
        "checkedAt": "2026-11-16T11:05:21.460236Z",
        "sha256": "7c5d9216d036f30bd0a046922a20c56921cd51c736ea9d9ee586be059502e582",
        "displayUrl": "https://laws.e-gov.go.jp/law/346AC0000000073",
        "lawRevisionId": "346AC0000000073_20250601_504AC0000000068",
        "revisionStatus": "CurrentEnforced"
      }
    ],
    "fields": [
      {
        "id": "child_birth_date",
        "type": "date",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "child_residence",
        "type": "enum",
        "values": [
          "japan",
          "overseas"
        ],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "recipient_role",
        "type": "enum",
        "values": [
          "parent",
          "designated_caregiver",
          "guardian",
          "other_caregiver",
          "facility_or_foster"
        ],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "custody",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "livelihood_relationship",
        "type": "enum",
        "values": [
          "same_livelihood",
          "maintains_livelihood",
          "unconfirmed"
        ],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "parents_overseas",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "designated_by_parent",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "separated_parents",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "cohabits_with_child",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "study_abroad",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "prior_japan_residence_over_3_years",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "overseas_education",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "lives_with_parent_or_guardian",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "within_3_years_of_leaving_japan",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "repeat_short_study",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "facility_or_foster_placement",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "short_placement_or_day_attendance",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "public_servant",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "municipal_certification",
        "type": "enum",
        "values": [
          "approved",
          "not_applied",
          "pending",
          "unknown"
        ],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "event_date",
        "type": "date",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "application_date",
        "type": "date",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "recipient_residence",
        "type": "enum",
        "values": [
          "japan",
          "overseas"
        ],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "higher_livelihood_maintainer",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "separate_livelihood_from_other_carer",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      },
      {
        "id": "not_cared_by_parents_or_designee",
        "type": "boolean",
        "values": [],
        "required": false,
        "missing": "requires_review"
      }
    ],
    "clauses": [
      {
        "id": "age",
        "category": "eligibility",
        "kind": "fiscal_age_limit",
        "fields": [
          "child_birth_date"
        ],
        "value": {
          "age": 18,
          "end": "first_march31_on_or_after_age_attainment",
          "inclusive": true
        },
        "source": "guide",
        "locator": "1.支給対象",
        "verification": "source_checked",
        "missing": "requires_review"
      },
      {
        "id": "residence",
        "category": "eligibility",
        "kind": "residence_with_exception",
        "fields": [
          "child_residence",
          "study_abroad"
        ],
        "value": {
          "default": "japan",
          "exception": "study"
        },
        "source": "guide",
        "locator": "制度ルール1",
        "verification": "source_checked",
        "missing": "requires_review"
      },
      {
        "id": "income",
        "category": "eligibility",
        "kind": "no_income_limit",
        "fields": [],
        "value": {
          "incomeLimit": null
        },
        "source": "reform",
        "locator": "所得制限なし",
        "verification": "source_checked",
        "missing": "requires_review"
      },
      {
        "id": "recipient",
        "category": "recipient",
        "kind": "case_review",
        "fields": [
          "recipient_role",
          "custody",
          "livelihood_relationship",
          "recipient_residence",
          "not_cared_by_parents_or_designee"
        ],
        "value": {
          "parent": "custody_and_same_livelihood",
          "other_caregiver": "custody_and_maintains_livelihood",
          "decision": "municipal_review",
          "domestic_address_or_corporate_office": true,
          "other_caregiver_prerequisite": "not_cared_by_parents_or_designee_or_not_same_livelihood",
          "parent_route_excludes": "facility_placement"
        },
        "source": "law",
        "locator": "第4条第1項",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "designated",
        "category": "recipient",
        "kind": "case_review",
        "fields": [
          "parents_overseas",
          "designated_by_parent",
          "recipient_role"
        ],
        "value": {
          "role": "designated_caregiver",
          "residence": "japan",
          "exception": "dormitory_case_review"
        },
        "source": "faq",
        "locator": "Q8",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "guardian",
        "category": "recipient",
        "kind": "case_review",
        "fields": [
          "recipient_role",
          "custody"
        ],
        "value": {
          "role": "guardian",
          "details": "individual_review",
          "priority_over": "parent",
          "law_article": "4.1.1"
        },
        "source": "guide",
        "locator": "制度ルール4",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "separated",
        "category": "priority",
        "kind": "case_review",
        "fields": [
          "separated_parents",
          "cohabits_with_child",
          "separate_livelihood_from_other_carer"
        ],
        "value": {
          "priority": "cohabiting_recipient",
          "trigger": "divorce_negotiation_or_equivalent",
          "additional_requirement": "separate_livelihood_from_other_carer",
          "law_article": "4.4"
        },
        "source": "guide",
        "locator": "制度ルール2",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "study",
        "category": "exception",
        "kind": "all_with_exception",
        "fields": [
          "study_abroad",
          "prior_japan_residence_over_3_years",
          "overseas_education",
          "lives_with_parent_or_guardian",
          "within_3_years_of_leaving_japan"
        ],
        "value": {
          "all": {
            "study_abroad": true,
            "prior_japan_residence_over_3_years": true,
            "overseas_education": true,
            "lives_with_parent_or_guardian": false,
            "within_3_years_of_leaving_japan": true
          },
          "exception": "repeat_study"
        },
        "source": "faq",
        "locator": "Q9",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "repeat_study",
        "category": "exception",
        "kind": "case_review",
        "fields": [
          "repeat_short_study"
        ],
        "value": {
          "may_override": "prior_japan_residence_over_3_years",
          "decision": "individual_review"
        },
        "source": "faq",
        "locator": "Q9注記",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "placement",
        "category": "recipient",
        "kind": "case_review",
        "fields": [
          "facility_or_foster_placement",
          "recipient_role"
        ],
        "value": {
          "default_recipient": "facility_or_foster",
          "exception": "short_placement"
        },
        "source": "faq",
        "locator": "Q10",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "short_placement",
        "category": "exception",
        "kind": "case_review",
        "fields": [
          "short_placement_or_day_attendance"
        ],
        "value": {
          "short_period_months_max": 2,
          "day_attendance": true,
          "may_remain": "parent",
          "additional_conditions": "individual_review"
        },
        "source": "faq",
        "locator": "Q10注記",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "application",
        "category": "procedure",
        "kind": "certification_required",
        "fields": [
          "municipal_certification"
        ],
        "value": {
          "required": true,
          "decision": "authority_certification",
          "late_application": "not_automatic_ineligibility"
        },
        "source": "guide",
        "locator": "認定請求",
        "verification": "source_checked",
        "missing": "requires_review"
      },
      {
        "id": "office",
        "category": "procedure",
        "kind": "application_office",
        "fields": [
          "public_servant",
          "recipient_role"
        ],
        "value": {
          "ordinary": "resident_municipality",
          "public_servant_own_child": "employer",
          "public_servant_foster_child": "resident_municipality"
        },
        "source": "faq",
        "locator": "Q12",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "deadline",
        "category": "procedure",
        "kind": "relative_deadline",
        "fields": [
          "event_date",
          "application_date"
        ],
        "value": {
          "event": "birth_or_move",
          "days": 15,
          "count_from": "day_after_event",
          "late_application": "may_lose_prior_months_not_whole_entitlement",
          "move_date_definition": "municipality_confirmation"
        },
        "source": "guide",
        "locator": "出生・転入の申請",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "multiple_recipients",
        "category": "priority",
        "kind": "case_review",
        "fields": [
          "higher_livelihood_maintainer",
          "cohabits_with_child",
          "separate_livelihood_from_other_carer"
        ],
        "value": {
          "default_priority": "higher_livelihood_maintainer",
          "override": "separated",
          "decision": "authority_review"
        },
        "source": "law",
        "locator": "第4条第2～4項",
        "verification": "requires_review",
        "missing": "requires_review"
      },
      {
        "id": "dormitory_case_review",
        "category": "exception",
        "kind": "case_review",
        "fields": [
          "cohabits_with_child",
          "designated_by_parent",
          "custody",
          "livelihood_relationship"
        ],
        "value": {
          "non_cohabitation": "may_still_qualify",
          "decision": "authority_review"
        },
        "source": "faq",
        "locator": "Q8の寮等の別居例",
        "verification": "requires_review",
        "missing": "requires_review"
      }
    ]
  }
];
