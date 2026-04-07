"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeResponse = void 0;
const buffer_1 = require("buffer");
function writeResponse(obj) {
    const body = buffer_1.Buffer.from(JSON.stringify(obj), 'utf8');
    const header = buffer_1.Buffer.alloc(4);
    header.writeUInt32LE(body.length, 0);
    process.stdout.write(buffer_1.Buffer.concat([header, body]));
}
exports.writeResponse = writeResponse;
