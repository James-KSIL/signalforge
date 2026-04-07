"use strict";
/**
 * Core Binding Types
 *
 * Type definitions used by core binding logic
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BINDING_POLICY = void 0;
/**
 * Default binding policy
 */
exports.DEFAULT_BINDING_POLICY = {
    tempPinTtlMinutes: 30,
    maxPendingBindings: 100,
    pendingBindingTtlMinutes: 30,
    requireConfirmationForManual: true,
    allowRecentProjectBinding: true,
};
