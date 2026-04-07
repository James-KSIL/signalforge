import { ForgeEvent, EventRole } from './event.types';
export declare const ALLOWED_EVENT_ROLES: EventRole[];
export declare function isAllowedEventRole(role?: string): role is EventRole;
export declare function generateId(): string;
export declare function toDispatchId(dispatchThreadId?: string | null): string | undefined;
export declare function normalizeRole(role?: string): EventRole;
export declare function safeRole(role?: string): EventRole;
export declare function assertValidEvent(e: Partial<ForgeEvent>): ForgeEvent;
export declare function createEvent(input: Partial<ForgeEvent>): ForgeEvent;
