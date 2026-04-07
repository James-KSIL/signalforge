import * as vscode from 'vscode';
import type { PinState } from '@signalforge/shared/dist/types/binding';
/**
 * VS Code Extension Pin State Service
 *
 * Manages project pin state: temporary (TTL) or persistent.
 *
 * Critical rule:
 * If pin expires, surface notification.
 * No silent fallback to next authority source.
 *
 * ADR 0009: Project Identity Binding & Dispatch Authority
 */
export declare class PinStateService {
    private readonly storageKey;
    private readonly extensionContext;
    private expirationCheckInterval?;
    constructor(context: vscode.ExtensionContext);
    setTemporaryPin(projectId: string, workspaceRoot: string, ttlMinutes?: number): Promise<void>;
    setPersistentPin(projectId: string, workspaceRoot: string): Promise<void>;
    clearPin(): Promise<void>;
    getPinState(): PinState | undefined;
    getResolvedPinState(): PinState | null;
    isPinValid(): boolean;
    private startExpirationMonitor;
    private emitExpirationEvent;
    dispose(): void;
}
