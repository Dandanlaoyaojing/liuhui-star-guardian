import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const projectRoot = new URL("..", import.meta.url).pathname;
const sourcePath = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/m01-flashlight-round-lines-hard-palette-v1/m01-flashlight-round-lines-hard-palette-v1-a-black-ink-outline.png"
);
const outlinedPath = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/m01-flashlight-round-lines-hard-palette-v1/m01-flashlight-round-lines-hard-palette-v1-a-black-ink-outline-deepened.png"
);
const syncTargets = [
  join(projectRoot, "assets/resources/art/stage1-m01/runtime-sprites/surfaces/m01-single-flashlight-tool.png"),
  join(projectRoot, "assets/art/stage1-m01/m01-single-flashlight-tool.png"),
  join(projectRoot, "docs/design/generated-m01-art-slices/m01-single-flashlight-tool-runtime-fixed.png"),
  join(projectRoot, "docs/design/generated-m01-art-slices/m01-generated-watercolor-psd-assets/parts/flashlight_single_three_buttons.png")
];

const source = readPng(sourcePath);
const outlined = paintInkOutline(source);

writePng(outlinedPath, outlined.width, outlined.height, outlined.data);
for (const target of syncTargets) {
  writePng(target, outlined.width, outlined.height, outlined.data);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      sourcePath,
      outlinedPath,
      syncTargets
    },
    null,
    2
  )
);

function paintInkOutline(image) {
  const width = image.width;
  const height = image.height;
  const output = new Uint8Array(image.data);
  const alphaMask = buildAlphaMask(image);
  const ink = [8, 8, 7];
  const warmInk = [18, 17, 13];
  const outerRadius = 2.8;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const sourceAlpha = image.data[offset + 3];
      const edgeDistance = nearestMaskDistance(alphaMask, width, height, x, y, Math.ceil(outerRadius));

      if (edgeDistance <= outerRadius && sourceAlpha < 64) {
        const pressure = inkPressure(x, y, 17);
        const edgeFade = Math.pow((outerRadius - edgeDistance) / outerRadius, 1.18);
        const alpha = clamp(edgeFade * (0.48 + pressure * 0.22), 0, 0.66);
        compositePixel(output, width, x, y, mixRgb(ink, warmInk, pressure * 0.18), alpha);
      }

      const insideEdgeDistance = nearestClearDistance(alphaMask, width, height, x, y, 5);
      if (sourceAlpha > 24 && insideEdgeDistance <= 3.6) {
        const pressure = inkPressure(x, y, 31);
        const alpha = clamp((3.6 - insideEdgeDistance) / 3.6, 0, 1) * (0.18 + pressure * 0.18);
        compositePixel(output, width, x, y, mixRgb(ink, warmInk, pressure * 0.12), alpha);
      }
    }
  }

  strengthenExistingInkLines(image, output, width, height, ink, warmInk);

  keepTransparentCorners(output, width, height);
  return { width, height, data: output };
}

function buildAlphaMask(image) {
  const mask = new Uint8Array(image.width * image.height);
  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = image.data[index * 4 + 3] > 36 ? 1 : 0;
  }
  return mask;
}

function nearestMaskDistance(mask, width, height, x, y, radius) {
  let nearest = Infinity;
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    if (yy < 0 || yy >= height) {
      continue;
    }
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (xx < 0 || xx >= width || mask[yy * width + xx] === 0) {
        continue;
      }
      const distance = Math.hypot(xx - x, yy - y);
      if (distance < nearest) {
        nearest = distance;
      }
    }
  }
  return nearest;
}

function nearestClearDistance(mask, width, height, x, y, radius) {
  let nearest = Infinity;
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    if (yy < 0 || yy >= height) {
      continue;
    }
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (xx < 0 || xx >= width || mask[yy * width + xx] !== 0) {
        continue;
      }
      const distance = Math.hypot(xx - x, yy - y);
      if (distance < nearest) {
        nearest = distance;
      }
    }
  }
  return nearest;
}

function strengthenExistingInkLines(image, output, width, height, ink, warmInk) {
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      if (image.data[offset + 3] <= 80) {
        continue;
      }

      const lum = luminance(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
      if (lum > 64 || nearbyDarkCoverage(image, width, height, x, y) > 6) {
        continue;
      }

      const pressure = inkPressure(x, y, 53);
      const alpha = clamp(0.08 + pressure * 0.13, 0, 0.18);
      compositePixel(output, width, x, y, mixRgb(ink, warmInk, pressure * 0.18), alpha);
    }
  }
}

function nearbyDarkCoverage(image, width, height, x, y) {
  let count = 0;
  for (let yy = y - 2; yy <= y + 2; yy += 1) {
    for (let xx = x - 2; xx <= x + 2; xx += 1) {
      if (xx < 0 || xx >= width || yy < 0 || yy >= height) {
        continue;
      }
      const offset = (yy * width + xx) * 4;
      if (
        image.data[offset + 3] > 80 &&
        luminance(image.data[offset], image.data[offset + 1], image.data[offset + 2]) <= 64
      ) {
        count += 1;
      }
    }
  }
  return count;
}

function compositePixel(data, width, x, y, rgb, alpha) {
  if (alpha <= 0) {
    return;
  }
  const offset = (y * width + x) * 4;
  const srcAlpha = clamp(alpha, 0, 1);
  const dstAlpha = data[offset + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha <= 0) {
    return;
  }
  data[offset] = clampByte((rgb[0] * srcAlpha + data[offset] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  data[offset + 1] = clampByte((rgb[1] * srcAlpha + data[offset + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  data[offset + 2] = clampByte((rgb[2] * srcAlpha + data[offset + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  data[offset + 3] = clampByte(outAlpha * 255);
}

function inkPressure(x, y, seed) {
  return (
    noise2(x * 0.035, y * 0.04, seed) * 0.54 +
    noise2(x * 0.09 + 2.7, y * 0.08 - 1.6, seed + 11) * 0.3 +
    noise2(x * 0.21 - 3.1, y * 0.17 + 4.3, seed + 23) * 0.16
  );
}

function keepTransparentCorners(data, width, height) {
  for (const [x, y] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ]) {
    const offset = (y * width + x) * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
}

function readPng(path) {
  const bytes = readFileSync(path);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const idatChunks = [];

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Expected 8-bit RGB/RGBA PNG: ${path}`);
  }

  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkData = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") {
      idatChunks.push(chunkData);
    }
    if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const channels = colorType === 6 ? 4 : 3;
  const sourceStride = width * channels;
  const data = new Uint8Array(width * height * 4);
  const unfiltered = new Uint8Array(width * height * channels);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < sourceStride; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= channels ? unfiltered[y * sourceStride + x - channels] : 0;
      const up = y > 0 ? unfiltered[(y - 1) * sourceStride + x] : 0;
      const upLeft = y > 0 && x >= channels ? unfiltered[(y - 1) * sourceStride + x - channels] : 0;
      unfiltered[y * sourceStride + x] =
        (filter === 0
          ? raw
          : filter === 1
            ? raw + left
            : filter === 2
              ? raw + up
              : filter === 3
                ? raw + Math.floor((left + up) / 2)
                : raw + paeth(left, up, upLeft)) & 0xff;
    }
    sourceOffset += sourceStride;
    for (let x = 0; x < width; x += 1) {
      const sourcePixel = y * sourceStride + x * channels;
      const targetPixel = (y * width + x) * 4;
      data[targetPixel] = unfiltered[sourcePixel];
      data[targetPixel + 1] = unfiltered[sourcePixel + 1];
      data[targetPixel + 2] = unfiltered[sourcePixel + 2];
      data[targetPixel + 3] = channels === 4 ? unfiltered[sourcePixel + 3] : 255;
    }
  }

  return { width, height, data };
}

function writePng(path, width, height, rgba) {
  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  writeFileSync(path, Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDelta = Math.abs(estimate - left);
  const upDelta = Math.abs(estimate - up);
  const upLeftDelta = Math.abs(estimate - upLeft);
  if (leftDelta <= upDelta && leftDelta <= upLeftDelta) {
    return left;
  }
  return upDelta <= upLeftDelta ? up : upLeft;
}

function noise2(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = rand2(x0, y0, seed);
  const b = rand2(x0 + 1, y0, seed);
  const c = rand2(x0, y0 + 1, seed);
  const d = rand2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function rand2(x, y, seed) {
  let value = Math.imul(x ^ seed, 374761393) + Math.imul(y ^ (seed << 1), 668265263);
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function mixRgb(a, b, t) {
  return [
    clampByte(a[0] * (1 - t) + b[0] * t),
    clampByte(a[1] * (1 - t) + b[1] * t),
    clampByte(a[2] * (1 - t) + b[2] * t)
  ];
}

function luminance(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
