import * as vscode from 'vscode';
import { PinStateService } from '../services/pinStateService';
/**
 * Command: SignalForge: Pin Project Until Unpinned
 *
 * Creates persistent pin (power-user mode)
 * Pin remains until explicitly unpinned
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export declare function pinProjectPersistent(pinStateService: PinStateService): Promise<void>;
/**
 * Register pin project (persistent) command
 *
 * @param context Extension context
 * @param pinStateService Pin state service
 */
export declare function registerPinProjectPersistent(context: vscode.ExtensionContext, pinStateService: PinStateService): void;
