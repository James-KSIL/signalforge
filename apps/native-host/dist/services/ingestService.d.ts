import type { NativeBridgeResponse } from '@signalforge/shared/dist/types/messages';
export declare function closeNativeHostDatabase(): Promise<void>;
export declare function getBootstrapSignalFilePath(): string;
export declare function getBootstrapSignalDbPath(): string;
export declare function drainBootstrapAuthoritySignal(): NativeBridgeResponse | null;
export declare function handleInbound(raw: any): Promise<NativeBridgeResponse>;
