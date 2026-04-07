"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStdinTransport = void 0;
const buffer_1 = require("buffer");
function startStdinTransport(onMessage, onError) {
    const stdin = process.stdin;
    let buffer = buffer_1.Buffer.alloc(0);
    stdin.resume();
    stdin.on('readable', () => {
        let chunk;
        while ((chunk = stdin.read()) !== null) {
            buffer = buffer_1.Buffer.concat([buffer, chunk]);
            while (buffer.length >= 4) {
                const length = buffer.readUInt32LE(0);
                if (buffer.length - 4 < length)
                    break;
                const frame = buffer.slice(4, 4 + length);
                buffer = buffer.slice(4 + length);
                try {
                    onMessage(JSON.parse(frame.toString('utf8')));
                }
                catch (error) {
                    onError?.(error instanceof Error ? error : new Error(String(error)));
                }
            }
        }
    });
}
exports.startStdinTransport = startStdinTransport;
