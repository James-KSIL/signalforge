import * as vscode from 'vscode';
import { PinStateService } from '../services/pinStateService';
/**
 * Command: SignalForge: Pin Project (30 min)
 *
 * Creates temporary pin for focused session (30 minutes)
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export declare function pinProjectTemporary(pinStateService: PinStateService, ttlMinutes?: number): Promise<void>;
/**
 * Register pin project (temporary) command
 *
 * @param context Extension context
 * @param pinStateService Pin state service
 */
export declare function registerPinProjectTemporary(context: vscode.ExtensionContext, pinStateService: PinStateService): void;
