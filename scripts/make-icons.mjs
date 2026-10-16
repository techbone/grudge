// Builds every favicon format from web/src/app/icon.svg.
//   node scripts/make-icons.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(join(root, "web/package.json"))("sharp");
const app = join(root, "web/src/app");
const svg = readFileSync(join(app, "icon.svg"));
const png = (size, input = svg) => sharp(input, { density: Math.max(72, size * 3) }).resize(size, size).png().toBuffer();

// icon.png: 512, rounded tile, for browsers and Android
writeFileSync(join(app, "icon.png"), await png(512));

// apple-icon.png: iOS wants an opaque square and rounds it itself, so drop the tile's corners
const flat = Buffer.from(readFileSync(join(app, "icon.svg"), "utf8").replace('rx="14"', 'rx="0"'));
writeFileSync(join(app, "apple-icon.png"), await png(180, flat));

// favicon.ico: 16, 32, 48 PNG frames in one ICO container
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map((s) => png(s)));
const head = Buffer.alloc(6 + sizes.length * 16);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  head[e] = s;
  head[e + 1] = s;
  head.writeUInt16LE(1, e + 4);
  head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(frames[i].length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += frames[i].length;
});
writeFileSync(join(app, "favicon.ico"), Buffer.concat([head, ...frames]));
console.log("wrote icon.png, apple-icon.png, favicon.ico");
