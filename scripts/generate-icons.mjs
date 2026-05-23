import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = readFileSync(join(publicDir, "icon.svg"));

for (const size of [192, 512]) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(join(publicDir, `icon-${size}.png`), png);
  console.log(`Wrote icon-${size}.png`);
}
