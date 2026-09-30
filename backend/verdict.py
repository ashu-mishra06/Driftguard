"""Combined DriftGuard verdict policy.

This implements the proposal written in Core_SIH-2026_v3.1.txt:
- A + B flagged -> REJECT
- A-only + high cost-weight signature -> REJECT
- A-only otherwise -> FLAG_FOR_REVIEW
- B-only -> FLAG_FOR_REVIEW
- neither -> PASS

The v3 document still labels this rule as a proposal for approval. The code
therefore exposes POLICY_STATUS so the team can see exactly what is being used.
"""

from __future__ import annotations

from typing import Any, Dict


POLICY_STATUS = "PROPOSED_TEAM_RULE_V3"

COST_WEIGHTS = {
    "Gate Oxide Degradation": "high",
    "Bond Wire Fatigue": "medium",
    "Generic Latent Defect": "low",
}



def compute_verdict(module_a: Dict[str, Any], module_b: Dict[str, Any]) -> Dict[str, Any]:
    a_flagged = bool(module_a.get("flagged"))
    b_flagged = bool(module_b.get("flagged"))
    signature = module_a.get("signature")
    cost_weight = COST_WEIGHTS.get(signature)

    if a_flagged and b_flagged:
        verdict = "REJECT"
        action = "Immediate rejection"
        rationale = "Both independent screening modules flag the component."
    elif a_flagged and not b_flagged:
        if cost_weight == "high":
            verdict = "REJECT"
            action = "Immediate rejection"
            rationale = (
                f"Module A flagged the component and matched the {signature} signature, "
                "whose illustrative project cost weight is high."
            )
        else:
            verdict = "FLAG_FOR_REVIEW"
            action = "Manual review"
            rationale = (
                "Module A flagged the component, but the matched signature does not carry "
                "the high illustrative cost weight required by the proposal for automatic rejection."
            )
    elif (not a_flagged) and b_flagged:
        verdict = "FLAG_FOR_REVIEW"
        action = "Manual review"
        rationale = (
            "Module B is an early-warning predictor; a Module B-only flag is not sufficient "
            "for automatic rejection under the proposal."
        )
    else:
        verdict = "PASS"
        action = "Proceed"
        rationale = "Neither screening module is above its frozen decision threshold."

    confidence = module_a.get("signature_confidence")
    confidence_text = (
        f" Signature validation confidence shown for the matched prototype: {confidence:.2f}."
        if confidence is not None
        else ""
    )

    explanation = (
        f"{rationale}{confidence_text} "
        f"Recommended action: {action}. "
        "Cost weights are illustrative project assumptions, not sourced industry figures."
    )

    return {
        "verdict": verdict,
        "recommendation": action,
        "cost_weight": cost_weight,
        "policy_status": POLICY_STATUS,
        "explanation": explanation,
    }


__all__ = ["COST_WEIGHTS", "POLICY_STATUS", "compute_verdict"]
