import { Buffer } from 'buffer';

export function writeResponse(obj: any) {
  const s = JSON.stringify(obj);
  const b = Buffer.from(s, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(b.length, 0);
  const out = Buffer.concat([header, b]);
  process.stdout.write(out);
}
