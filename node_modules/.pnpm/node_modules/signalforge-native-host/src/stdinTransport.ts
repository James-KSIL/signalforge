import { Buffer } from 'buffer';

export function startStdinTransport(onMessage: (message: any) => void, onError?: (error: Error) => void) {
  const stdin = process.stdin;
  let buffer = Buffer.alloc(0);

  stdin.resume();
  stdin.on('readable', () => {
    let chunk: Buffer | null;
    while ((chunk = stdin.read()) !== null) {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0);
        if (buffer.length - 4 < length) break;

        const frame = buffer.slice(4, 4 + length);
        buffer = buffer.slice(4 + length);

        try {
          onMessage(JSON.parse(frame.toString('utf8')));
        } catch (error: any) {
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  });
}