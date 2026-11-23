"""Approval gate: fail closed unless all evidence is explicitly verified."""
REQUIRED = ("no_additional_cost", "no_owner_action", "legal_sources_verified",
            "non_destructive", "tests_passed", "rollback_verified",
            "permission_verified", "ci_passed", "deployment_safe")
def decision(evidence):
    missing = [key for key in REQUIRED if evidence.get(key) is not True]
    if evidence.get("major_spec_change") is not False:
        missing.append("major_spec_change_not_excluded")
    if evidence.get("authentication_change") is not False:
        missing.append("authentication_change_not_excluded")
    if evidence.get("data_deletion") is not False:
        missing.append("data_deletion_not_excluded")
    if evidence.get("payment_change") is not False:
        missing.append("payment_change_not_excluded")
    return {"allowed": not missing, "missing_or_unverified": missing}
