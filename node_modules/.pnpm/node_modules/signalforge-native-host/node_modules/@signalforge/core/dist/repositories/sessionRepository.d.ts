export declare function createSession(db: any, row: any): Promise<void>;
export declare function endSession(db: any, sessionId: string, endedAt: string): Promise<void>;
export declare function createSessionWithEvent(db: any, row: any): Promise<void>;
export declare function endSessionWithEvent(db: any, sessionId: string, endedAt: string): Promise<void>;
export declare function getActiveSessionByProject(db: any, projectId: string): Promise<any | null>;
export declare function getSessionById(db: any, sessionId: string): Promise<any | null>;
declare const _default: {
    createSession: typeof createSession;
    endSession: typeof endSession;
    getActiveSessionByProject: typeof getActiveSessionByProject;
    getSessionById: typeof getSessionById;
};
export default _default;
