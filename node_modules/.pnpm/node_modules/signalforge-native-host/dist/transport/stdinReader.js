"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStdinReader = void 0;
function startStdinReader(onMessage) {
    const stdin = process.stdin;
    stdin.resume();
    stdin.on('readable', () => {
        let chunk;
        while ((chunk = stdin.read()) !== null) {
            // buffer may contain multiple frames; caller should handle framing
            onMessage(chunk);
        }
    });
}
exports.startStdinReader = startStdinReader;
