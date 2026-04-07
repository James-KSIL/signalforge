import type { ChatEventRow } from '@signalforge/shared/dist/types/entities';
export declare function ingestChatEvent(db: any, row: Partial<ChatEventRow & {
    content?: any;
}>): Promise<void>;
