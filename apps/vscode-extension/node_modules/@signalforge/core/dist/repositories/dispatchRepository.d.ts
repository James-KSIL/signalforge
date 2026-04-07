export declare function getLatestDispatch(db: any): Promise<{
    chat_thread_id: string;
    dispatch_id?: string;
    project_id?: string;
    created_at: string;
} | null>;
declare const _default: {
    getLatestDispatch: typeof getLatestDispatch;
};
export default _default;
