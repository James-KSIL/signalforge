import { Buffer } from 'buffer';

export function startStdinReader(onMessage: (msg: Buffer) => void) {
  const stdin = process.stdin;
  stdin.resume();
  stdin.on('readable', () => {
    let chunk: Buffer | null;
    while ((chunk = stdin.read()) !== null) {
      // buffer may contain multiple frames; caller should handle framing
      onMessage(chunk);
    }
  });
}
