export declare function compileDispatch(chatThreadId: string, db: any, options?: {
    targetDir?: string;
    projectId?: string;
    sessionId?: string;
}): Promise<{
    contractPath: string;
    promptPath: string;
    copilotPath: string;
}>;
