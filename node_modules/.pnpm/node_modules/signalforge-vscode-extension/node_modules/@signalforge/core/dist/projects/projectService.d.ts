export declare function deriveProjectIdFromPath(workspacePath: string): string;
export declare function deriveProjectId(workspacePath: string, alias?: string | null): string;
export declare function ensureProjectRecord(db: any, projectId: string, name: string, gitRoot: string, workspaceUri: string): Promise<void>;
declare const _default: {
    deriveProjectId: typeof deriveProjectId;
    deriveProjectIdFromPath: typeof deriveProjectIdFromPath;
    ensureProjectRecord: typeof ensureProjectRecord;
};
export default _default;
