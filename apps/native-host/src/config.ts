import path from 'path';
import type { AuthoritySource } from '@signalforge/shared/dist/types/binding';
export const DEFAULT_DB = path.resolve(process.cwd(), './data/signalforge.db');
export const NATIVE_HOST_NAME = 'com.signalforge.nativehost';
export const ALLOWED_AUTHORITIES: AuthoritySource[] = [
	'pinned_project',
	'active_workspace',
	'recent_project',
	'manual_selection',
];
