/**
 * Cost-policy display copy for Settings / Admin.
 * Keep in sync with ``ai_engine/industries/hvac/cost_policy.py``.
 *
 * Behavior only — amounts and "is it free?" come from get_pricing_info.
 */

export const COST_POLICY_WAIVE_FEE_TEXT =
  "How to present a figure from get_pricing_info only: for a repair, if the tool includes a diagnostic fee and a waive-on-approval rule, state that clearly; for a tune-up, state the flat price the tool returns; for a replacement or large/multi-unit job, present the tool's estimate or quote guidance (never invent that an estimate is free). If the tool has no clear figure, say the technician confirms exact pricing on site."

export const COST_POLICY_NO_WAIVE_FEE_TEXT =
  "How to present a figure from get_pricing_info only: for a repair, state the diagnostic fee the tool returns and that it applies whether or not they proceed; for a tune-up, state the flat price the tool returns; for a replacement, present the tool's estimate or quote guidance (never invent that an estimate is free)."

export const COST_POLICY_COMMERCIAL_ADDON_TEXT =
  "For commercial or multi-unit jobs, take the details and follow the tool's guidance for an on-site or individual quote — never invent commercial pricing."

export type CostPolicyValue = {
  waive_diagnostic_fee: boolean
  serves_commercial: boolean
}
