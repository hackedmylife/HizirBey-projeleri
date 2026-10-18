import {readFile} from 'node:fs/promises';
export async function speechFixture() {
  const bytes = await readFile(new URL('./fixtures/speech-16k.wav', import.meta.url));
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4);
    if (bytes.toString('ascii', offset, offset + 4) === 'data') return Float32Array.from({length: length / 2}, (_, i) => bytes.readInt16LE(offset + 8 + i * 2) / 32768);
    offset += 8 + length + length % 2;
  }
  throw new Error('Public speech fixture has no PCM data.');
}
export function musicSignal(seconds = 6, level = 0.006) {
  return Float32Array.from({length: Math.round(seconds * 16000)}, (_, i) => {
    const t = i / 16000;
    return level * (Math.sin(2 * Math.PI * 220 * t) + 0.6 * Math.sin(2 * Math.PI * 330 * t) + 0.3 * Math.sin(2 * Math.PI * 440 * t));
  });
}
