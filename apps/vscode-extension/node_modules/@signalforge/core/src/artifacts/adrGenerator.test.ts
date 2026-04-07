/**
 * @jest-environment node
 * Phase 2.5 Regression Test Suite
 * 
 * This file uses Jest syntax and is excluded from TypeScript compilation
 * via tsconfig.json. The @ts-check comment below allows IDE support while
 * tsconfig excludes it from the build.
 * 
 * Run tests with: jest adrGenerator.test.ts
 */
// @ts-nocheck

import { buildADR } from './adrGenerator';
import { buildSessionSummary } from '../sessions/sessionSummary';
import { ForgeEvent } from '../events/event.types';

/**
 * Phase 2.5 Regression Test Suite
 * 
 * Validates that artifact generation uses canonical event stream
 * and maintains invariants around outcome rendering, skip counts, and
 * invalid event handling.
 */

// Helper: Create a valid ForgeEvent
function createEvent(overrides: Partial<ForgeEvent> = {}): ForgeEvent {
  const defaults: ForgeEvent = {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    thread_id: 'test-thread-1',
    role: 'assistant',
    event_type: 'dispatch_seeded',
    content: {
      summary: 'Test event summary',
    },
    timestamp: new Date().toISOString(),
  };
  return { ...defaults, ...overrides };
}

// Helper: Create an outcome event
function createOutcomeEvent(overrides: Partial<ForgeEvent> = {}): ForgeEvent {
  return createEvent({
    role: 'outcome',
    event_type: 'outcome_logged',
    content: {
      summary: 'Outcome achieved',
      status: 'success',
      details: 'WHAT CHANGED:\nImplemented feature X\n\nRESISTANCE:\nNone\n\nNEXT STEP:\nDeploy to prod',
    },
    ...overrides,
  });
}

// Helper: Create a malformed/invalid event
function createInvalidEvent(overrides: Partial<ForgeEvent> = {}): ForgeEvent {
  return createEvent({
    content: {
      summary: '', // Empty summary makes event invalid
    },
    ...overrides,
  });
}

describe('Phase 2.5 Regression Tests - Artifact Generation', () => {
  describe('Test A: ADR renders outcomes from canonical event stream', () => {
    it('should render outcomes when valid outcome events are present', () => {
      const events: ForgeEvent[] = [
        createEvent({ role: 'user', content: { summary: 'Starting session' } }),
        createOutcomeEvent({ content: { summary: 'Feature A complete', status: 'success', details: 'WHAT CHANGED:\nBuilt feature A' } }),
        createOutcomeEvent({ content: { summary: 'Feature B complete', status: 'partial', details: 'WHAT CHANGED:\nPartially built feature B' } }),
      ];

      const adr = buildADR(events);

      // Assert: renderedOutcomes > 0
      expect(adr).toContain('renderedOutcomes: 2');
      expect(adr).toContain('totalOutcomes: 2');

      // Assert: expected summaries appear
      expect(adr).toContain('Feature A complete');
      expect(adr).toContain('Feature B complete');
      expect(adr).toContain('- Status: success');
      expect(adr).toContain('- Status: partial');
    });

    it('should compute accurate skip counts for invalid outcomes', () => {
      const events: ForgeEvent[] = [
        createEvent({ role: 'user', content: { summary: 'Starting session' } }),
        // Valid outcome
        createOutcomeEvent({ 
          content: { 
            summary: 'Task complete', 
            status: 'success',
            details: 'Details here'
          } 
        }),
        // Invalid outcome (missing summary)
        createOutcomeEvent({
          content: {
            summary: '', // Invalid: empty summary
            status: 'success',
          }
        }),
      ];

      const adr = buildADR(events);

      // Assert: skip count reflects filtered outcome
      expect(adr).toContain('Skipped Legacy/Invalid Outcomes: 1');
      expect(adr).toContain('renderedOutcomes: 1');
      expect(adr).toContain('totalOutcomes: 2');
    });

    it('should render zero outcomes gracefully when no outcomes present', () => {
      const events: ForgeEvent[] = [
        createEvent({ role: 'user', content: { summary: 'Starting session' } }),
        createEvent({ role: 'assistant', content: { summary: 'Response to user' } }),
      ];

      const adr = buildADR(events);

      expect(adr).toContain('renderedOutcomes: 0');
      expect(adr).toContain('totalOutcomes: 0');
      expect(adr).toContain('- none'); // No outcomes rendered
    });
  });

  describe('Test B: Session summary renders outcomes from canonical event stream', () => {
    it('should render outcomes consistently with ADR', () => {
      const events: ForgeEvent[] = [
        createEvent({ role: 'user', content: { summary: 'Planning phase' } }),
        createOutcomeEvent({ 
          content: { 
            summary: 'Analysis complete', 
            status: 'success',
            details: 'Analyzed requirements'
          } 
        }),
        createOutcomeEvent({ 
          content: { 
            summary: 'Design review pending', 
            status: 'partial',
            details: 'Design in progress'
          } 
        }),
      ];

      const summary = buildSessionSummary(events);

      // Assert: outcomes rendered in session summary
      expect(summary).toContain('renderedOutcomes: 2');
      expect(summary).toContain('totalOutcomes: 2');
      expect(summary).toContain('Analysis complete');
      expect(summary).toContain('Design review pending');
      expect(summary).toContain('[success]');
      expect(summary).toContain('[partial]');
    });

    it('should include outcome summary section with skip counts', () => {
      const events: ForgeEvent[] = [
        createOutcomeEvent({ content: { summary: 'Valid outcome', status: 'success' } }),
        createOutcomeEvent({ content: { summary: '', status: 'success' } }), // Invalid
      ];

      const summary = buildSessionSummary(events);

      expect(summary).toContain('Outcome Summary');
      expect(summary).toContain('- totalOutcomes: 2');
      expect(summary).toContain('- renderedOutcomes: 1');
      expect(summary).toContain('- Skipped Legacy/Invalid Outcomes: 1');
    });
  });

  describe('Test C: Alternate projection absence does not break output', () => {
    it('should render complete artifact with only canonical events (no outcomes table)', () => {
      // Simulate scenario: outcomes table is empty/unavailable,
      // but canonical events contain outcome roles
      const cannonicalEvents: ForgeEvent[] = [
        createEvent({ role: 'user', content: { summary: 'User request' } }),
        createOutcomeEvent({ content: { summary: 'Processing outcome', status: 'success' } }),
        createEvent({ role: 'assistant', content: { summary: 'Generated response' } }),
      ];

      const adr = buildADR(cannonicalEvents);
      const summary = buildSessionSummary(cannonicalEvents);

      // Assert: both artifacts generate without error and include outcomes
      expect(adr).toBeTruthy();
      expect(adr.length > 0).toBe(true);
      expect(adr).toContain('renderedOutcomes: 1');

      expect(summary).toBeTruthy();
      expect(summary.length > 0).toBe(true);
      expect(summary).toContain('renderedOutcomes: 1');
    });

    it('should not include undefined, null, or [object Object] in output', () => {
      const events: ForgeEvent[] = [
        createEvent({ content: { summary: 'Valid event' } }),
        createOutcomeEvent({ 
          content: { 
            summary: 'Outcome event',
            status: 'success',
            details: 'Details text'
          } 
        }),
      ];

      const adr = buildADR(events);
      const summary = buildSessionSummary(events);

      // Assert: no serialization artifacts in output
      expect(adr).not.toContain('[object Object]');
      expect(adr).not.toContain('undefined');
      expect(summary).not.toContain('[object Object]');
      expect(summary).not.toContain('undefined');
    });
  });

  describe('Test D: Invalid events are excluded transparently', () => {
    it('should exclude events with empty summaries and track skip count', () => {
      const events: ForgeEvent[] = [
        createEvent({ content: { summary: 'Valid event' } }),
        createInvalidEvent({ content: { summary: '' } }), // Invalid: no summary
        createInvalidEvent({ content: { summary: '   ' } }), // Invalid: whitespace only
        createEvent({ content: { summary: 'Another valid event' } }),
      ];

      const adr = buildADR(events);

      // Assert: invalid events skipped and counted
      expect(adr).toContain('Skipped Legacy/Invalid Events: 2');
      // Only two valid events should appear or be counted
      expect(adr).toContain('Valid event');
      expect(adr).toContain('Another valid event');
    });

    it('should exclude outcomes with no meaningful text and increment skip count', () => {
      const events: ForgeEvent[] = [
        createOutcomeEvent({ 
          content: { 
            summary: 'Good outcome',
            status: 'success',
            details: 'Has proper details'
          } 
        }),
        // Invalid outcome: all optional fields empty
        createOutcomeEvent({
          content: {
            summary: '',
            details: '',
          }
        }),
        // Invalid outcome: only whitespace
        createOutcomeEvent({
          content: {
            summary: '   ',
            details: null,
          }
        }),
      ];

      const adr = buildADR(events);

      // Assert: invalid outcomes filtered, skip count accurate
      expect(adr).toContain('renderedOutcomes: 1');
      expect(adr).toContain('Skipped Legacy/Invalid Outcomes: 2');
      expect(adr).toContain('totalOutcomes: 3');
      expect(adr).toContain('Good outcome');
    });

    it('should maintain clean primary sections despite invalid events', () => {
      const events: ForgeEvent[] = [
        createInvalidEvent({ content: { summary: '' } }),
        createEvent({ role: 'user', content: { summary: 'Valid user message' } }),
        createInvalidEvent({ content: { summary: 'undefined' } }), // Pseudo-undefined
        createEvent({ role: 'assistant', content: { summary: 'Valid assistant response' } }),
      ];

      const adr = buildADR(events);

      // Assert: primary content is clean (no invalid entries)
      const decisionSection = adr.match(/## Decisions\n([\s\S]*?)\n\n/);
      expect(decisionSection).toBeTruthy();
      const decisions = decisionSection![1];
      expect(decisions).not.toContain('undefined');
      expect(decisions).not.toContain('[object Object]');
    });

    it('should correctly categorize role-invalid events as skipped', () => {
      const events: ForgeEvent[] = [
        createEvent({ role: 'assistant', content: { summary: 'Valid assistant' } }),
        createEvent({ role: 'invalid_role' as any, content: { summary: 'Invalid role' } }),
        createEvent({ role: 'user', content: { summary: 'Valid user' } }),
      ];

      const adr = buildADR(events);

      // Assert: event with invalid role is skipped
      expect(adr).toContain('Skipped Legacy/Invalid Events: 1');
      expect(adr).toContain('Valid assistant');
      expect(adr).toContain('Valid user');
      expect(adr).not.toContain('Invalid role');
    });
  });

  describe('Determinism Verification', () => {
    it('should produce identical output for identical input (deterministic)', () => {
      const events: ForgeEvent[] = [
        createEvent({ role: 'user', content: { summary: 'Request' } }),
        createOutcomeEvent({ content: { summary: 'Outcome 1', status: 'success' } }),
        createOutcomeEvent({ content: { summary: 'Outcome 2', status: 'fail' } }),
      ];

      const adr1 = buildADR(events);
      const adr2 = buildADR(events);
      const summary1 = buildSessionSummary(events);
      const summary2 = buildSessionSummary(events);

      expect(adr1).toBe(adr2);
      expect(summary1).toBe(summary2);
    });

    it('should preserve thread_id consistently across regeneration', () => {
      const threadId = 'deterministic-thread-123';
      const events: ForgeEvent[] = [
        createEvent({ 
          thread_id: threadId,
          content: { summary: 'Event in specific thread' } 
        }),
      ];

      const adr = buildADR(events);
      const summary = buildSessionSummary(events);

      expect(adr).toContain(`# ADR: ${threadId}`);
      expect(summary).toContain(`Session Summary for ${threadId}`);
    });
  });

  describe('Invariant Compliance', () => {
    it('should only derive outcomes from ForgeEvent objects (Invariant 1)', () => {
      // This test verifies the architecture: all outcome data comes from events
      const events: ForgeEvent[] = [
        createOutcomeEvent({
          content: {
            summary: 'Only this should render',
            status: 'success',
            details: 'From ForgeEvent content field',
          },
        }),
      ];

      const adr = buildADR(events);

      // Assert: outcome rendered, and it matches the event content
      expect(adr).toContain('Only this should render');
      expect(adr).toContain('success');
      expect(adr).toContain('From ForgeEvent content field');
    });

    it('should not duplicate outcome rendering logic (Invariant 3)', () => {
      // Both generators use the same normalization logic;
      // outcomes should render identically in ADR and session summary
      const events: ForgeEvent[] = [
        createOutcomeEvent({
          content: {
            summary: 'Test outcome',
            status: 'partial',
            details: 'Same outcome text',
          },
        }),
      ];

      const adr = buildADR(events);
      const summary = buildSessionSummary(events);

      // Extract outcome summary from both
      const adrOutcomeSection = adr.match(/### (.*?)\n/);
      const summaryOutcomeSection = summary.match(/\[partial\] (.*?) \(/);

      expect(adrOutcomeSection![1]).toBe('Test outcome');
      expect(summaryOutcomeSection![1]).toBe('Test outcome');
    });

    it('should include skip counts for all filtered rows (Invariant 5)', () => {
      const events: ForgeEvent[] = [
        createEvent({ content: { summary: 'Valid 1' } }),
        createInvalidEvent({ content: { summary: '' } }),
        createOutcomeEvent({ content: { summary: 'Valid outcome', status: 'success' } }),
        createInvalidEvent({ content: { summary: 'null' } }),
        createOutcomeEvent({ content: { summary: '', status: 'success' } }), // Invalid outcome
      ];

      const adr = buildADR(events);

      // Assert: all skip counts present and accurate
      expect(adr).toContain('Skipped Legacy/Invalid Events: 2');
      expect(adr).toContain('Skipped Legacy/Invalid Outcomes: 1');
      // Both numbers are explicitly visible; no silent data loss
    });
  });
});
