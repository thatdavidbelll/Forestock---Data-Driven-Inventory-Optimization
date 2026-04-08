# Shopify Submission TODO

This is the single practical checklist for moving Forestock from Shopify hardening into an actual submission decision.

## Phase 0 — Environment setup
- [ ] Prepare local runtime with `docs/SHOPIFY_LOCAL_ENV_RUNBOOK.md`
- [ ] Create local env files from:
  - `shopify-app/.env.local.example`
  - `forestock-backend/.env.local.shopify.example`
- [ ] Run the startup flow in `docs/SHOPIFY_LOCAL_COMMAND_SEQUENCE.md`
- [ ] Confirm a public HTTPS tunnel URL exists for the Shopify app
- [ ] Confirm Shopify app config points to the active tunnel URL

## Phase 1 — Runtime evidence
- [ ] Execute `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`
- [ ] Capture results in `docs/SHOPIFY_VALIDATION_EVIDENCE_TEMPLATE.md`
- [ ] Validate fresh install
- [ ] Validate provisioning/linking
- [ ] Validate catalog import
- [ ] Validate historical order backfill
- [ ] Validate webhook-driven updates
- [ ] Validate uninstall
- [ ] Validate reinstall
- [ ] Validate standalone-access activation flow if it remains supported
- [ ] Record pass/fail evidence with screenshots and logs

## Phase 2 — Fix only real blockers
- [ ] Turn validation failures into a short bug list
- [ ] Fix only launch-critical Shopify bugs
- [ ] Re-run failed validation scenarios after each fix
- [ ] Update `docs/CHANGELOG.md`
- [ ] Update `docs/VERIFICATION_MATRIX.md`
- [ ] Update `docs/FINAL_LAUNCH_BOARD.md`

## Phase 3 — Submission materials
- [ ] Finalize app positioning statement
- [ ] Finalize merchant-facing short description
- [ ] Finalize longer listing copy
- [ ] Capture real screenshots from validated flow
- [ ] Prepare reviewer walkthrough notes
- [ ] Confirm support email
- [ ] Confirm support URL
- [ ] Confirm privacy policy URL
- [ ] Confirm website/marketing URL if needed
- [ ] Confirm scope justification in `docs/SHOPIFY_APP_REVIEW_PACK.md`

## Phase 4 — Operational readiness
- [ ] Confirm support/runbook is good enough for install/sync failures
- [ ] Confirm merchant-impact notes for reinstall/scope changes
- [ ] Confirm uninstall/reinstall recovery guidance
- [ ] Confirm logs and DB inspection path for support

## Phase 5 — Final decision
- [ ] Make final status call: GO / LIMITED_PILOT_GO / NO_GO
- [ ] If GO: prepare actual Shopify submission
- [ ] If LIMITED_PILOT_GO: restrict rollout and keep manual support
- [ ] If NO_GO: list exact blockers, owners, and next review date

## Hard blockers for public submission
- [ ] No critical install/auth/runtime failures remain
- [ ] No critical sync failures remain
- [ ] Merchant first-run experience is understandable
- [ ] Uninstall/reinstall is trustworthy
- [ ] Privacy/support artifacts exist
- [ ] Review pack is complete enough to hand to a reviewer
