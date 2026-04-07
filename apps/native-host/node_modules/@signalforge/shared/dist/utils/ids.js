"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpleId = void 0;
function simpleId(prefix = '') {
    // small stable id for prototyping
    const r = Math.random().toString(36).slice(2, 10);
    return prefix ? `${prefix}_${r}` : r;
}
exports.simpleId = simpleId;
