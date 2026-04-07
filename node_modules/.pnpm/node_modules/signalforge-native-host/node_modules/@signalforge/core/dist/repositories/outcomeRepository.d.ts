export declare function insertOutcome(db: any, row: any): Promise<void>;
export declare function insertOutcomeWithEvent(db: any, row: any): Promise<void>;
export declare function getOutcomesByDispatch(db: any, dispatchThreadId: string): Promise<any[]>;
export declare function getOutcomesByProject(db: any, projectId: string): Promise<any[]>;
declare const _default: {
    insertOutcome: typeof insertOutcome;
    getOutcomesByDispatch: typeof getOutcomesByDispatch;
    getOutcomesByProject: typeof getOutcomesByProject;
};
export default _default;
