# Phase 4 Architecture Contract: Signal Extraction Layer

**Status**: Implemented | **Date**: 2026-04-01 | **Theme**: Signal extraction, pattern recognition, higher-order synthesis

## Executive Summary

Phase 4 transforms SignalForge from a deterministic artifact system into a **higher-order engineering signal system** that extracts reusable insight from sessions, dispatches, outcomes, and traces without violating the core invariants:

- ✅ Canonical event stream as sole source of truth
- ✅ Core owns all semantics
- ✅ Deterministic artifact generation
- ✅ Project-scoped storage boundaries

**New capability**: Detect recurring engineering patterns and translate system activity into hirable engineering signal, all through deterministic rule-based extraction.

## Architecture Overview

```
┌─ Canonical Event Stream (chat_events)
│
├─ Event Tagging Layer (eventTags.ts)
│  └─ Deterministic rule-based semantic classification
│
├─ Pattern Extraction Core (patterns/)
│  ├─ patternExtractor.ts → orchestrates all detection
│  ├─ patternRules.ts → 40+ deterministic rules
│  └─ patternTypes.ts → stable pattern data structures
│
├─ Signal Generators (new artifacts/)
│  ├─ signalIndex.ts → JSON reference index
│  ├─ insightsGenerator.ts → Weekly analysis
│  ├─ portfolioSignalGenerator.ts → Interview signal
│  └─ linkedInTopicsUpgrade.ts → Multi-session topics
│
└─ Output Artifacts (docs/<project_id>/)
   ├─ signal/signal-index.json
   ├─ insights/YYYY-MM-DD_*.md
   ├─ portfolio/YYYY-MM-DD_*_signal.md
   └─ posts/topics.md (upgraded)
```

## Core Modules

### 1. Event Tagging Infrastructure (`packages/core/src/events/eventTags.ts`)

**Purpose**: Apply deterministic semantic tags to events for later extraction.

**Tags** (9 domains):
- `architecture` - System design, invariants, refactoring
- `normalization` - Data canonicalization, cleanup, migration
- `runtime-path` - Execution flow, tracing, performance
- `source-of-truth` - Event stream integrity, determinism
- `artifact-routing` - Where/how artifacts stored
- `validation` - Testing, checks, assertions
- `regression` - Bugs, failures, breakages
- `cleanup` - Debt removal, dead code
- `migration` - Schema/contract changes

**Implementation**:
```typescript
// Deterministic extraction from event properties
function extractTags(event: ForgeEvent): EventTag[] {
  const tags: Set<EventTag> = new Set();
  
  // Rule: event_type categorization
  if (event.event_type === 'dispatch_seeded') tags.add('runtime-path');
  
  // Rule: content pattern matching
  if (event.content.summary.toLowerCase().includes('architecture')) {
    tags.add('architecture');
  }
  
  return Array.from(tags).sort();
}
```

**Key guarantee**: Tags are computed fresh every call from event properties only. No mutations, no hidden state.

### 2. Pattern Extraction Core (`packages/core/src/patterns/`)

#### 2.1 Pattern Types (`patternTypes.ts`)

**Five pattern categories**:

1. **FailureModePattern** - Recurring failures with severity
   ```typescript
   {
     type: 'failure-mode',
     pattern_id: 'pattern_failure-mode_null-thread-id',
     name: 'null-thread-id-mismatch',
     occurrences: 3,
     severity: 'high',
     resolutions: ['ensure thread_id resolved before insert']
   }
   ```

2. **RefactorThemePattern** - Recurring cleanup activities
   ```typescript
   {
     type: 'refactor-theme',
     pattern_id: 'pattern_refactor-theme_unused-imports',
     name: 'unused-imports-cleanup',
     occurrences: 5,
     affectedModules: ['repository', 'events']
   }
   ```

3. **ArchitectureDecisionPattern** - Recurring architectural choices
   ```typescript
   {
     type: 'architecture-decision',
     pattern_id: 'pattern_architecture-decision_deterministic-artifacts',
     name: 'deterministic-artifact-generation',
     principle: 'All artifacts reproducible from canonical event stream',
     decisions: 8,
     tradeoffs: ['Limited to deterministic patterns']
   }
   ```

4. **FrictionPointPattern** - Workflow challenges
   ```typescript
   {
     type: 'friction-point',
     pattern_id: 'pattern_friction-point_schema-migration',
     name: 'schema-migration-complexity',
     frequency: 4,
     symptoms: ['Queries break after schema changes']
   }
   ```

5. **AcceptanceCriteriaPattern** - Recurring quality checks
   ```typescript
   {
     type: 'acceptance-criteria',
     pattern_id: 'pattern_acceptance-criteria_determinism',
     name: 'determinism-validation',
     criteria: ['Same input produces same output', ...],
     passingRate: 1.0
   }
   ```

#### 2.2 Pattern Rules (`patternRules.ts`)

**40+ deterministic rules** organized by pattern type:

- **Failure Mode Detection**: Identifies recurring failures from outcomes with `status='fail'`
- **Refactor Theme Detection**: Groups cleanup events by type (unused imports, dead code, etc.)
- **Architecture Decision Detection**: Extracts principles from event patterns
- **Friction Point Detection**: Identifies workflow bottlenecks
- **Acceptance Criteria Detection**: Validates recurring quality gates

**No machine learning, embeddings, or fuzzy matching**. Pure keyword matching and event type analysis.

#### 2.3 Pattern Extractor (`patternExtractor.ts`)

**Main entry point**: `extractPatterns(projectId, events, outcomes)`

**Produces**:
1. Detected patterns (all types)
2. Pattern contexts (evidence linking)
3. Metrics (frequency, severity, confidence)
4. Relationships (causal, refinement, blocking)

**Guarantees**:
- Deterministic: same input → same output
- Complete: all events examined
- Traceable: every pattern has evidence_events linkage

### 3. Signal Index Generator (`packages/core/src/signals/signalIndex.ts`)

**Purpose**: Create lightweight machine-readable index for later analysis.

**Output**: `docs/<project_id>/signal/signal-index.json`

**Structure**:
```json
{
  "version": "1.0.0",
  "generated_at": "2026-04-01T...",
  "project_id": "...",
  "time_range": { "start": "...", "end": "..." },
  "summary": {
    "total_signals": 42,
    "by_type": { "dispatch": 10, "session": 5, "outcome": 15, ... },
    "unique_sessions": 3,
    "unique_dispatches": 8
  },
  "signals": [
    {
      "id": "dispatch_xyz",
      "type": "dispatch",
      "title": "Dispatch xyz",
      "summary": "...",
      "timestamp": "...",
      "tags": ["runtime-path", "validation"],
      "pattern_ids": ["pattern_failure-mode_null-thread-id"],
      "related_signals": ["outcome_abc"]
    }
  ],
  "patterns": {
    "total_detected": 8,
    "by_category": { "failure-mode": 2, "refactor-theme": 3, ... },
    "highest_severity_patterns": [...]
  },
  "metadata": {
    "deterministic": true,
    "source": "canonical-event-stream",
    "validated": true
  }
}
```

**Key property**: Substrate for Blacksmith/meta-analysis work. Contains all necessary references without circular dependencies.

### 4. Engineering Insights Generator (`packages/core/src/artifacts/insightsGenerator.ts`)

**Purpose**: Answer the fundamental questions about system engineering.

**Output**: `docs/<project_id>/insights/YYYY-MM-DD_<label>.md`

**Questions answered**:
1. What kinds of problems were solved this period?
2. What kinds of issues recur?
3. What architectural lessons are emerging?
4. What constraints show up repeatedly?
5. What does this suggest about the system and engineering strengths?

**Structure**:
- Context (event counts, sessions, dispatches)
- Recurring themes (with frequency, evidence, impact)
- Repeated breakages (patterns, severity, resolution)
- Architecture lessons (principle, why it matters, tradeoffs)
- Repeated constraints (reason, affected areas, adaptation)
- Inferred engineering strengths (evidence, opportunity)
- System characteristics (maturity, complexity, evolution state)
- Data quality assessment (determinism, completeness, consistency)
- Next hardening priorities (ranked top 5)

**Example markdown output**:
```markdown
# Engineering Insights: Week of April 1

## Context
- Events analyzed: 127
- Sessions: 3
- Dispatches: 8
- Outcomes: 12

## Recurring Themes
### Regular maintenance and cleanup activities
**Frequency**: 3 occurrences
**Evidence**: unused-imports-cleanup, dead-code-removal, schema-simplification
**Impact**: Keeps codebase healthy and prevents debt accumulation
**Recommendation**: Integrate cleanup into sprint planning

## Repeated Breakages
- **null-thread-id-mismatch** (high): 2x → Ensure thread_id resolved before write
- **query-data-mismatch** (critical): 1x → Normalize data format before storage

## Architecture Lessons
### Deterministic Artifact Generation
**Why it matters**: Ensures reproducibility and verifiability of outputs
**Applies to**: artifact generation, validation, ADR generation
**Tradeoff**: Requires canonical event stream, cannot use external models

## Next Hardening Priorities
1. Fix 1 critical failure mode: null-thread-id-mismatch
2. Add regression tests for top 2 failure modes
3. Document 2 architecture decisions as formal ADRs
```

### 5. Portfolio Signal Generator (`packages/core/src/artifacts/portfolioSignalGenerator.ts`)

**Purpose**: Translate system activity into hirable engineering signal.

**Output**: `docs/<project_id>/portfolio/YYYY-MM-DD_<range>_signal.md`

**Structure**:
```markdown
# Engineering Portfolio Signal: [Period]

## Summary
[Narrative about capabilities demonstrated]

## Key Achievements
- Identified and documented N failure mode patterns
- Established M core architecture principles
- X% success rate on delivered outcomes
- N proactive cleanup initiatives

## Engineering Signals
For each significant outcome/pattern:
- Title
- Problem
- Approach
- Constraints handled
- Tradeoffs made
- Failures encountered
- Resolution approach
- Platform relevance
- Internal tooling relevance
- Bullet points for conversation

## Technical Capabilities Demonstrated
- Large-scale event stream processing
- Production failure diagnosis
- Principled system architecture
- Proactive technical debt management
- Canonical data model implementation
- Deterministic system validation

## Leadership Indicators
- Strategic architectural planning
- Identifies and addresses workflow friction
- Thorough documentation of decisions
- Quality-first mindset
- Continuous improvement culture

## Systems Thinking
- Defines and enforces system invariants
- Recognizes architectural tradeoffs
- Links effects to root causes
- Optimizes for end-to-end efficiency
- Models systems through event streams
- Anticipates failure modes

## Interview-Ready Narratives
### Handling Complex Architectural Trade-offs
[Story about determinism decision]

### Systematic Failure Diagnosis
[Story about null-thread-id bug]

### Proactive Technical Debt Reduction
[Story about cleanup patterns]
```

### 6. Pattern-Aware LinkedIn Topics (`packages/core/src/artifacts/linkedInTopicsUpgrade.ts`)

**Purpose**: Multi-session signal-driven topic generation (upgrade from session-local).

**Output**: Markdown file in `docs/<project_id>/posts/`

**5 Topic Categories**:

1. **Engineering Lessons** (max 2)
   - Building Deterministic Systems
   - Systematic Failure Analysis
   - Technical Debt as Signal

2. **Business Impact** (max 2)
   - Reproducible Systems Build Trust
   - Detecting Patterns Before Crisis

3. **Architectural Thinking** (max 1)
   - Architecture Principle: [principle]
   - Constraints Create Clarity

**Example output**:
```markdown
# LinkedIn Topic Suggestions

## Topics Available for Sharing

### 1. Building Deterministic Systems in Production
**Category**: engineering-lesson
**Narrative**: Spent the last sprint hardening artifact generation...
**Hashtags**: #systems-engineering #determinism #production-hardening
**Status**: ✅ Ready to share

### 2. Reproducible Systems Build Trust
**Category**: business-impact
**Narrative**: Invested in canonical event stream architecture...
**Status**: ✅ Ready to share
```

## Constraints and Guarantees

### Non-negotiable Invariants

1. **Canonical Event Stream Constraint**
   - All patterns derived from `chat_events` only
   - No double-writing to multiple tables
   - Event stream is sole source of truth

2. **Determinism Guarantee**
   - Identical event sets produce identical artifacts
   - No random IDs, timestamps in artifact paths, or sorting
   - Outputs stable across restarts and environments

3. **Project Scoping**
   - All outputs under `docs/<project_id>/`
   - No cross-project artifact mixing
   - Project isolation maintained

4. **Core Semantics Ownership**
   - Core package defines all pattern types
   - Core package defines all tagging rules
   - Extension cannot introduce duplicate semantics

5. **Phase 2.5 Semantics Frozen**
   - ADR generation logic unchanged
   - Session summary structure preserved
   - Outcome rendering consistent
   - All invariants maintained

### Out of Scope (Phase 4 Explicitly Excluded)

- ❌ External LLM synthesis or model invocation
- ❌ Browser-to-Copilot direct dispatch automation
- ❌ Autonomous code editing
- ❌ Cloud sync or network operations
- ❌ Dashboards or UI render layers
- ❌ Vector search or embeddings
- ❌ Semantic search infrastructure
- ❌ Blacksmith/TONY-level loops (Phase 5+)

## Acceptance Criteria ✅

Phase 4 is complete when:

1. ✅ Pattern extraction core exists at `packages/core/src/patterns/`
   - `patternExtractor.ts` - orchestration
   - `patternRules.ts` - 40+ deterministic rules
   - `patternTypes.ts` - stable data structures

2. ✅ Signal index generator creates JSON reference
   - File: `docs/<project_id>/signal/signal-index.json`
   - Contains dispatch, session, outcome, artifact references
   - Pattern IDs included

3. ✅ Engineering insights generator works end-to-end
   - File: `docs/<project_id>/insights/YYYY-MM-DD_*.md`
   - Answers all 5 key questions
   - Deterministic from identical input

4. ✅ Portfolio signal generator produces interview signal
   - File: `docs/<project_id>/portfolio/YYYY-MM-DD_*_signal.md`
   - Problem-approach-constraints-tradeoffs-resolution format
   - Interview-ready narratives

5. ✅ LinkedIn topics upgraded to pattern-aware
   - Multi-session analysis (not session-local)
   - 3-5 topics max
   - Grouped by engineering/business/architectural angles

6. ✅ Event tagging infrastructure in place
   - File: `packages/core/src/events/eventTags.ts`
   - 9 tag domains
   - Deterministic rule-based assignment

7. ✅ Validation script tests all deliverables
   - File: `scripts/validate-phase-4.ts`
   - 10 validation tests
   - Verifies determinism, scope, constraints

8. ✅ All outputs remain deterministic
   - Identical input → Identical output (bit-for-bit)
   - No external service calls
   - No random generation

9. ✅ Canonical event stream maintained
   - All patterns from chat_events only
   - No bypassing the canonical stream
   - No duplicate semantics

10. ✅ Project scoping intact
    - All artifacts in project directory
    - No shared/global artifacts
    - Cross-project queries filtered

## Usage Examples

### Extract patterns from a project
```typescript
import { extractPatterns } from '@signalforge/core/patterns/patternExtractor';

const events = await getChatEventsByProject(db, projectId);
const outcomes = await getOutcomesByProject(db, projectId);

const patterns = extractPatterns(projectId, events, outcomes);
console.log(`Found ${patterns.total_patterns} patterns`);
```

### Generate engineering insights
```typescript
import { generateInsights, renderInsightsMarkdown } from '@signalforge/core/artifacts/insightsGenerator';

const insights = generateInsights(projectId, events, patterns, outcomes);
const markdown = renderInsightsMarkdown(insights);

// Write to docs/<projectId>/insights/
fs.writeFileSync(outputPath, markdown);
```

### Generate portfolio signal
```typescript
import { generatePortfolioSignal, renderPortfolioSignalMarkdown } from '@signalforge/core/artifacts/portfolioSignalGenerator';

const portfolio = generatePortfolioSignal(projectId, events, patterns, outcomes);
const markdown = renderPortfolioSignalMarkdown(portfolio);

// Write to docs/<projectId>/portfolio/
fs.writeFileSync(outputPath, markdown);
```

### Generate LinkedIn topics
```typescript
import { generateLinkedInTopics, renderLinkedInTopicsMarkdown } from '@signalforge/core/artifacts/linkedInTopicsUpgrade';

const topics = generateLinkedInTopics(projectId, events, patterns);
const markdown = renderLinkedInTopicsMarkdown(topics);

// Write to docs/<projectId>/posts/
fs.writeFileSync(outputPath, markdown);
```

## Next Phase (Phase 5): Leveraging Signal for Higher-Order Intelligence

Phase 5 will use Phase 4's signal extraction as foundation for:
- Cross-project pattern comparison
- Opportunity identification
- Autonomous refactoring suggestions
- Blacksmith integration for meta-analysis
- TONY-level orchestration loops

But Phase 4 stands alone: deterministic, local-only, human-interpretable signal extraction.

---

**Phase 4 Complete**: ✅ 2026-04-01
**Next Review**: Phase 5 framing and architecture
