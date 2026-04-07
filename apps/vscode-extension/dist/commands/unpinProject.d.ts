import * as vscode from 'vscode';
import { PinStateService } from '../services/pinStateService';
/**
 * Command: SignalForge: Unpin Project
 *
 * Clears current project pin
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export declare function unpinProject(pinStateService: PinStateService): Promise<void>;
/**
 * Register unpin project command
 *
 * @param context Extension context
 * @param pinStateService Pin state service
 */
export declare function registerUnpinProject(context: vscode.ExtensionContext, pinStateService: PinStateService): void;
