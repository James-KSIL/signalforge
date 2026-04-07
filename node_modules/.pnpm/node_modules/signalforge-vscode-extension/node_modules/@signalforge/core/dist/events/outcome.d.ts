export type OutcomeInput = {
    projectId: string;
    sessionId?: string;
    dispatchId?: string;
    source: 'vscode' | 'browser' | 'cli';
    status: 'success' | 'fail' | 'partial';
    title: string;
    whatChanged: string;
    resistance?: string;
    nextStep: string;
};
export declare function buildOutcomeEvent(thread_id: string, input: OutcomeInput): import("./event.types").ForgeEvent;
