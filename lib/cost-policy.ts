/**
 * Cost-policy display copy for Settings / Admin.
 * Keep in sync with ``ai_engine/industries/hvac/cost_policy.py``.
 */

export const COST_POLICY_WAIVE_FEE_TEXT =
  "For a repair, state the diagnostic fee and that it's waived if they approve the repair that visit. For a tune-up, state the flat price. For a replacement or large/multi-unit job, offer the free in-home estimate instead of a fixed price. If a big or multi-unit job has no clear figure, say the technician confirms exact pricing on site."

export const COST_POLICY_NO_WAIVE_FEE_TEXT =
  'For a repair, state the diagnostic fee. The fee is not waived and applies whether or not they proceed. For a tune-up, state the flat price. For a replacement, offer the free in-home estimate.'

export const COST_POLICY_COMMERCIAL_ADDON_TEXT =
  'For commercial or multi-unit jobs, take the details and offer an on-site estimate — pricing is quoted individually.'

export type CostPolicyValue = {
  waive_diagnostic_fee: boolean
  serves_commercial: boolean
}
