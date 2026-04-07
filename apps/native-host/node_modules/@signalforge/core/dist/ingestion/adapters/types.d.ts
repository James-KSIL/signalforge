import { ForgeEvent, EventRole, EventType, EventSource } from '../../events/event.types';
export type AdapterInput = {
    thread_id: string;
    project_id: string;
    session_id?: string;
    dispatch_id?: string;
    role: EventRole;
    event_type: EventType;
    content: ForgeEvent['content'] | string;
    source_url?: string | null;
    matched_trigger?: string | null;
    artifact_refs?: string[];
};
export type AdapterResult = {
    event: ForgeEvent;
    source: EventSource;
};
