# ADR v1

## Header
- adr_id: adr_v1_c475eb9063e3f997
- timestamp: 2026-04-06T01:00:00.000Z
- dispatch_id: dispatch-002
- candidate_id: candidate-002
- contract_ref: null
- artifact_ref: null

## Context
- contract_summary: null
- affected_file_refs: []

## Decision
- REJECTED

## Rationale
- contract_gate_invariants:
  - gate_pass: false
  - failed_invariants: ["execution_signals_count >= 1", "file_refs.length >= 1 (resolved within workspace)"]
  - gate_failure_reason: execution_signals_count >= 1
- execution_signals:
  - build_command_detected: false
  - command_outcome_line_detected: false
  - test_result_detected: false
- rejection_reason: execution_signals_count >= 1

## Evidence
- artifact_id: null
- candidate_id: candidate-002
- dispatch_id: dispatch-002
- evidence_chain:
  - contract_ref: null
  - candidate_id: candidate-002
  - artifact_id: null
  - dispatch_id: dispatch-002
- file_refs: []
- execution_signals:
  - build_command_detected: false
  - command_outcome_line_detected: false
  - test_result_detected: false

## Consequences
- candidate rejected; no artifact created