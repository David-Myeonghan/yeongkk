const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PngInfo {
  width: number;
  height: number;
  colorType: number;
  hasTransparency: boolean;
}

const ALPHA_COLOR_TYPES = [4, 6];

export function readPng(bytes: Uint8Array): PngInfo {
  const buf = Buffer.from(bytes);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("PNG 파일이 아니에요");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  let hasTrns = false;
  for (let at = 8; at + 8 <= buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    if (type === "tRNS") hasTrns = true;
    if (type === "IEND") break;
    at += 12 + length;
  }
  return { width, height, colorType, hasTransparency: ALPHA_COLOR_TYPES.includes(colorType) || hasTrns };
}
