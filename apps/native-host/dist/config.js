"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_AUTHORITIES = exports.NATIVE_HOST_NAME = exports.DEFAULT_DB = void 0;
const path_1 = __importDefault(require("path"));
exports.DEFAULT_DB = path_1.default.resolve(process.cwd(), './data/signalforge.db');
exports.NATIVE_HOST_NAME = 'com.signalforge.nativehost';
exports.ALLOWED_AUTHORITIES = [
    'pinned_project',
    'active_workspace',
    'recent_project',
    'manual_selection',
];
