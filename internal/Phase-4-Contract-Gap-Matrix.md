# Phase 4 Contract Gap Matrix

Failure:
missing required tag emission: regression

Expected:
Event tagging emits full contract vocabulary including regression

Actual:
Tagger rules do not explicitly match the regression keyword in event text

Fix:
packages/core/src/events/eventTags.ts

---

Failure:
pattern missing required fields: category, subtype

Expected:
Each detected pattern includes pattern_id, category, subtype

Actual:
Pattern objects expose type but omit category/subtype aliases required by validator

Fix:
packages/core/src/patterns/patternExtractor.ts

---

Failure:
missing field: dispatch_ids

Expected:
Signal index includes dispatch_ids

Actual:
generator only provides nested summary.unique_dispatches and signals list

Fix:
packages/core/src/signals/signalIndex.ts

---

Failure:
missing field: context_window

Expected:
Insights include context_window plus required contract section arrays

Actual:
Insights expose period/context with different field names and omit context_window

Fix:
packages/core/src/artifacts/insightsGenerator.ts

---

Failure:
missing field: constraints on engineering_signal

Expected:
Each portfolio engineering signal includes constraints, tradeoffs, failures, resolution, interview_bullets

Actual:
generator uses constraints_handled, tradeoffs_made, failures_encountered, resolution_approach, bullet_points

Fix:
packages/core/src/artifacts/portfolioSignalGenerator.ts

---

Failure:
missing field: source_pattern_ids

Expected:
LinkedIn topic must include source_pattern_ids

Actual:
generator omits source_pattern_ids and uses non-contract category names

Fix:
packages/core/src/artifacts/linkedInTopicsUpgrade.ts

---

Failure:
insights generator does not expose source_event_ids

Expected:
Insights must reference canonical source_event_ids

Actual:
no canonical event linkage array is emitted

Fix:
packages/core/src/artifacts/insightsGenerator.ts

---

Failure:
signal index output_path missing project-scoped path

Expected:
Signal index exposes output_path scoped to docs/<project_id>/signal/

Actual:
index does not emit output_path/signal_index_path/insights_path/portfolio_path

Fix:
packages/core/src/signals/signalIndex.ts

---

Failure:
non-deterministic fallback IDs in pattern context linkage

Expected:
Pattern context linkage remains deterministic without Date.now fallbacks

Actual:
related_outcomes fallback uses Date.now when outcome_id is absent

Fix:
packages/core/src/patterns/patternExtractor.ts
