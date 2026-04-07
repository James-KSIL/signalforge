import type { ChatEventRow } from '@signalforge/shared/dist/types/entities';
export declare function insertChatEvent(db: any, row: Partial<ChatEventRow & {
    content?: any;
}>): Promise<void>;
export declare function getChatEventsByThread(db: any, chatThreadId: string): Promise<ChatEventRow[]>;
