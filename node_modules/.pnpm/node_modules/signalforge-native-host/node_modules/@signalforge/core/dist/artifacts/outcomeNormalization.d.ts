export type RenderableOutcome = {
    status: 'success' | 'fail' | 'partial' | 'blocked' | 'unknown';
    summary: string;
    details?: string;
    created_at: string;
};
export declare function normalizeOutcome(row: any): RenderableOutcome | null;
export declare function isRenderableOutcome(row: any): boolean;
