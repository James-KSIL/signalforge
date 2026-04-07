"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeResponse = void 0;
const buffer_1 = require("buffer");
function writeResponse(obj) {
    const s = JSON.stringify(obj);
    const b = buffer_1.Buffer.from(s, 'utf8');
    const header = buffer_1.Buffer.alloc(4);
    header.writeUInt32LE(b.length, 0);
    const out = buffer_1.Buffer.concat([header, b]);
    process.stdout.write(out);
}
exports.writeResponse = writeResponse;
