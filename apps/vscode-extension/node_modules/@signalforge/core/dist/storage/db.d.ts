export declare function getDefaultDbPath(): string;
export declare function ensureDbDir(dbPath: string): void;
export declare function openDatabase(dbPath?: string): any;
export declare function initSchema(db: any): Promise<void>;
