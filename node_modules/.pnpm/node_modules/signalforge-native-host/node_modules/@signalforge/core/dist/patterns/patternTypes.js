"use strict";
/**
 * Pattern Types and Structures
 *
 * Represents recurring engineering patterns detected from events and outcomes.
 * Patterns are deterministically identified and stable across runs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFrictionPointPattern = exports.isArchitectureDecisionPattern = exports.isFailureModePattern = exports.isDetectedPattern = exports.createPatternId = void 0;
function createPatternId(category, subtype) {
    // Deterministic ID from category + subtype
    return `pattern_${category}_${subtype}`;
}
exports.createPatternId = createPatternId;
/**
 * Check if object is a DetectedPattern
 */
function isDetectedPattern(x) {
    return x && typeof x === 'object' && 'type' in x && 'pattern_id' in x;
}
exports.isDetectedPattern = isDetectedPattern;
/**
 * Safe type guard for specific pattern types
 */
function isFailureModePattern(x) {
    return x && x.type === 'failure-mode' && Array.isArray(x.keywords);
}
exports.isFailureModePattern = isFailureModePattern;
function isArchitectureDecisionPattern(x) {
    return x && x.type === 'architecture-decision' && typeof x.principle === 'string';
}
exports.isArchitectureDecisionPattern = isArchitectureDecisionPattern;
function isFrictionPointPattern(x) {
    return x && x.type === 'friction-point' && Array.isArray(x.symptoms);
}
exports.isFrictionPointPattern = isFrictionPointPattern;
