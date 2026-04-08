# Shopify Validation Evidence Template

Use this file while executing `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`.

Create one filled copy per validation run, or append multiple runs with clear timestamps.

---

## Validation Run Metadata
- **Run date:**
- **Operator:**
- **Environment:** dev store / staging / local tunnel / deployed non-prod
- **Shopify dev store URL:**
- **Shop domain:**
- **Shopify app URL under test:**
- **Forestock backend URL under test:**
- **Database environment:**
- **Commit / branch:**
- **Notes:**

---

## Scenario 1 — Fresh install
- **Timestamp:**
- **Expected:** App installs, auth completes, embedded app loads, workspace is linked/provisioned.
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Screenshots:**
- **App logs:**
- **Backend logs:**
- **DB notes:**
- **Unresolved notes:**

## Scenario 2 — Catalog import on initial setup
- **Timestamp:**
- **Expected:** Products/inventory sync into Forestock with sane counts.
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Screenshots:**
- **App logs:**
- **Backend logs:**
- **DB notes:**
- **Unresolved notes:**

## Scenario 3 — Historical order backfill
- **Timestamp:**
- **Expected:** Historical Shopify orders populate Forestock sales meaningfully.
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Screenshots:**
- **App logs:**
- **Backend logs:**
- **DB notes:**
- **Unresolved notes:**

## Scenario 4 — Ongoing webhook updates
### 4a. Product create
- **Timestamp:**
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Evidence:**

### 4b. Product update
- **Timestamp:**
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Evidence:**

### 4c. Product delete
- **Timestamp:**
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Evidence:**

### 4d. Inventory update
- **Timestamp:**
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Evidence:**

### 4e. Order create
- **Timestamp:**
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Evidence:**

### Webhook summary
- **Overall status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Notes:**

## Scenario 5 — Standalone access request + activation
- **Timestamp:**
- **Expected:** Pre-activation login blocked, activation request works, activation completes, standalone login succeeds.
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT / NOT_RUN
- **Screenshots:**
- **Logs / token notes:**
- **DB notes:**
- **Unresolved notes:**

## Scenario 6 — Embedded app as primary merchant surface
- **Timestamp:**
- **Expected:** Merchant can understand setup and next steps without leaving Shopify.
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Screenshots:**
- **Usability notes:**
- **Unresolved notes:**

## Scenario 7 — Uninstall behavior
- **Timestamp:**
- **Expected:** Uninstall deactivates/disconnects the live Shopify link cleanly.
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Screenshots:**
- **Logs:**
- **DB notes:**
- **Unresolved notes:**

## Scenario 8 — Reinstall behavior
- **Timestamp:**
- **Expected:** Reinstall reuses/reconciles state without harmful duplication.
- **Actual:**
- **Status:** PASS / FAIL / PASS_WITH_CAVEAT
- **Screenshots:**
- **Logs:**
- **DB notes:**
- **Unresolved notes:**

---

## Scope Sufficiency / Minimization Check
- **Current scopes:** `read_products`, `read_inventory`, `read_orders`
- **Are current scopes sufficient?** yes / no / unknown
- **Are any scopes unnecessary?** yes / no / unknown
- **Notes:**

## Submission Artifact Check
- [ ] Privacy policy URL available
- [ ] Support email available
- [ ] Support URL available
- [ ] Real screenshots captured
- [ ] Reviewer notes drafted
- [ ] Scope justification confirmed

## Final Validation Summary
- **Overall recommendation:** GO / LIMITED_PILOT_GO / NO_GO
- **Critical blockers found:**
- **High-priority follow-ups:**
- **Accepted caveats:**
- **Recommended next action:**
