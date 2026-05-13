import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const projectRoot = new URL("..", import.meta.url).pathname;
const roundSourcePath = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/m01-generated-watercolor-psd-assets/parts/flashlight_single_three_buttons-lemmy-pink-v3.png"
);
const hardPaletteReferencePath = join(
  projectRoot,
  "assets/resources/art/stage1-m01/runtime-sprites/surfaces/m01-single-flashlight-tool.png"
);
const outRoot = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/m01-flashlight-round-lines-hard-palette-v1"
);

const roundSource = readPng(roundSourcePath);
const hardPaletteReference = readPng(hardPaletteReferencePath);
const referencePalette = extractReferencePalette(hardPaletteReference);

const variants = [
  {
    id: "a-balanced-gear-bronze",
    label: "A",
    body: mixRgb(referencePalette.body, [137, 132, 104], 0.35),
    head: mixRgb(referencePalette.head, [119, 126, 105], 0.3),
    rim: mixRgb(referencePalette.rim, [222, 206, 172], 0.45),
    lens: [229, 203, 144],
    shadow: mixRgb(referencePalette.shadow, [68, 70, 58], 0.35),
    buttonSat: 0.92,
    contrast: 1.0,
    warmth: 2
  },
  {
    id: "b-olive-mechanism",
    label: "B",
    body: [126, 133, 108],
    head: [106, 122, 112],
    rim: [219, 205, 173],
    lens: [226, 203, 148],
    shadow: [62, 70, 60],
    buttonSat: 0.86,
    contrast: 1.08,
    warmth: -1
  },
  {
    id: "c-rice-gray-rim",
    label: "C",
    body: [154, 143, 114],
    head: [124, 125, 101],
    rim: [226, 214, 185],
    lens: [232, 211, 158],
    shadow: [78, 76, 63],
    buttonSat: 0.82,
    contrast: 0.94,
    warmth: 4
  },
  {
    id: "d-graphite-ochre",
    label: "D",
    body: [118, 115, 91],
    head: [95, 106, 94],
    rim: [207, 190, 154],
    lens: [221, 194, 128],
    shadow: [45, 49, 43],
    buttonSat: 0.9,
    contrast: 1.16,
    warmth: 0
  }
];

const outputs = variants.map((variant) => {
  const image = recolorRoundFlashlight(roundSource, variant);
  const filePath = join(outRoot, `m01-flashlight-round-lines-hard-palette-v1-${variant.id}.png`);
  writePng(filePath, image.width, image.height, image.data);
  return { ...variant, filePath, image };
});

const contactSheetPath = join(outRoot, "m01-flashlight-round-lines-hard-palette-v1-contact-sheet.png");
writePng(contactSheetPath, 620, 960, buildContactSheet(outputs));

console.log(
  JSON.stringify(
    {
      ok: true,
      roundSourcePath,
      hardPaletteReferencePath,
      contactSheetPath,
      candidates: outputs.map((output) => output.filePath)
    },
    null,
    2
  )
);

function recolorRoundFlashlight(source, variant) {
  const data = new Uint8Array(source.data.length);
  const width = source.width;
  const height = source.height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = source.data[offset + 3];
      if (alpha <= 2) {
        continue;
      }

      const sourceRgb = [
        source.data[offset],
        source.data[offset + 1],
        source.data[offset + 2]
      ];
      const lum = luminance(sourceRgb);
      const region = classifyRegion(x, y, sourceRgb, lum);

      let targetRgb;
      if (region === "ink") {
        targetRgb = inkTone(sourceRgb, lum, variant);
      } else if (region === "lens") {
        targetRgb = shadeFromSource(sourceRgb, variant.lens, {
          neutralLum: 180,
          contrast: 0.9,
          warmth: variant.warmth + 7
        });
      } else if (region === "button-red") {
        targetRgb = shadeFromSource(sourceRgb, [153, 73, 70], {
          neutralLum: 128,
          contrast: 0.9,
          saturation: variant.buttonSat,
          warmth: 2
        });
      } else if (region === "button-yellow") {
        targetRgb = shadeFromSource(sourceRgb, [188, 141, 58], {
          neutralLum: 143,
          contrast: 0.86,
          saturation: variant.buttonSat,
          warmth: 5
        });
      } else if (region === "button-blue") {
        targetRgb = shadeFromSource(sourceRgb, [76, 100, 142], {
          neutralLum: 108,
          contrast: 0.88,
          saturation: variant.buttonSat,
          warmth: -3
        });
      } else if (region === "rim") {
        targetRgb = shadeFromSource(sourceRgb, variant.rim, {
          neutralLum: 157,
          contrast: 0.82 * variant.contrast,
          warmth: variant.warmth + 3
        });
      } else if (region === "head") {
        targetRgb = shadeFromSource(sourceRgb, variant.head, {
          neutralLum: 117,
          contrast: 0.98 * variant.contrast,
          warmth: variant.warmth - 2
        });
      } else {
        const xBias = (x - width * 0.5) / width;
        const yBias = (y - height * 0.52) / height;
        const bodyTarget = mixRgb(
          variant.body,
          variant.shadow,
          clamp(xBias * -0.34 + yBias * 0.2 + watercolorNoise(x, y, 17) * 0.18, 0, 0.38)
        );
        targetRgb = shadeFromSource(sourceRgb, bodyTarget, {
          neutralLum: 124,
          contrast: variant.contrast,
          warmth: variant.warmth
        });
      }

      const pooled = applyWatercolorPooling(targetRgb, x, y, variant);
      data[offset] = pooled[0];
      data[offset + 1] = pooled[1];
      data[offset + 2] = pooled[2];
      data[offset + 3] = alpha;
    }
  }

  enforceButtonReadability(data, width, height, variant);
  return { width, height, data };
}

function classifyRegion(x, y, rgb, lum) {
  const chroma = Math.max(...rgb) - Math.min(...rgb);
  if (lum < 47 || (lum < 72 && chroma < 42)) {
    return "ink";
  }

  if (insideEllipse(x, y, 100, 82, 52, 28, -0.22) || insideEllipse(x, y, 112, 92, 55, 31, -0.18)) {
    return "lens";
  }

  if (insideEllipse(x, y, 96, 222, 19, 18, 0)) {
    return "button-red";
  }
  if (insideEllipse(x, y, 94, 264, 20, 19, 0)) {
    return "button-yellow";
  }
  if (insideEllipse(x, y, 91, 311, 20, 19, 0)) {
    return "button-blue";
  }

  if (y < 128 && (x < 80 || x > 128 || lum > 130)) {
    return "rim";
  }

  if (y < 153) {
    return "head";
  }

  return "body";
}

function enforceButtonReadability(data, width, height, variant) {
  const buttons = [
    { cx: 96, cy: 222, rx: 17, ry: 16, color: [153, 73, 70] },
    { cx: 94, cy: 264, rx: 18, ry: 17, color: [188, 141, 58] },
    { cx: 91, cy: 311, rx: 18, ry: 17, color: [76, 100, 142] }
  ];

  for (const button of buttons) {
    for (let y = Math.floor(button.cy - button.ry - 3); y <= button.cy + button.ry + 3; y += 1) {
      for (let x = Math.floor(button.cx - button.rx - 3); x <= button.cx + button.rx + 3; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          continue;
        }
        const dx = (x - button.cx) / button.rx;
        const dy = (y - button.cy) / button.ry;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const offset = (y * width + x) * 4;
        if (data[offset + 3] <= 8 || distance > 1.16) {
          continue;
        }

        if (distance > 0.86) {
          const dark = mixRgb(variant.shadow, [31, 29, 23], 0.38);
          blendPixel(data, width, x, y, dark, clamp((1.15 - distance) * 1.65, 0, 0.82));
        } else if (distance < 0.78) {
          const highlight =
            distance < 0.28 && x < button.cx && y < button.cy
              ? mixRgb(button.color, [236, 220, 174], 0.38)
              : button.color;
          blendPixel(data, width, x, y, highlight, 0.35);
        }
      }
    }
  }
}

function shadeFromSource(sourceRgb, targetBase, options) {
  const sourceLum = luminance(sourceRgb);
  const delta = (sourceLum - options.neutralLum) * (options.contrast ?? 1);
  const texture = (sourceRgb[0] - sourceRgb[2]) * 0.045 + (sourceRgb[1] - sourceLum) * 0.025;
  const saturation = options.saturation ?? 1;
  const desaturated = mixRgb(targetBase, [luminance(targetBase), luminance(targetBase), luminance(targetBase)], 1 - saturation);
  return [
    clampByte(desaturated[0] + delta * 0.72 + texture + (options.warmth ?? 0)),
    clampByte(desaturated[1] + delta * 0.68 + texture * 0.55 + (options.warmth ?? 0) * 0.35),
    clampByte(desaturated[2] + delta * 0.56 - texture * 0.25 - (options.warmth ?? 0) * 0.22)
  ];
}

function inkTone(sourceRgb, lum, variant) {
  const lift = clamp((lum - 24) * 0.32, 0, 24);
  const base = mixRgb([25, 26, 22], variant.shadow, 0.28);
  return [
    clampByte(base[0] + lift),
    clampByte(base[1] + lift * 0.95),
    clampByte(base[2] + lift * 0.78)
  ];
}

function applyWatercolorPooling(rgb, x, y, variant) {
  const cloud = watercolorNoise(x, y, variant.label.charCodeAt(0));
  const edge = watercolorNoise(x * 0.7, y * 0.8, variant.label.charCodeAt(0) + 23);
  const shade = (cloud - 0.5) * 8 + (edge - 0.5) * 3;
  return [
    clampByte(rgb[0] + shade),
    clampByte(rgb[1] + shade * 0.92),
    clampByte(rgb[2] + shade * 0.74)
  ];
}

function extractReferencePalette(image) {
  return {
    rim: averageRegion(image, 30, 28, 138, 80, [216, 201, 170]),
    head: averageRegion(image, 36, 76, 136, 150, [126, 125, 103]),
    body: averageRegion(image, 70, 150, 130, 330, [154, 142, 112]),
    shadow: averageRegion(image, 52, 330, 146, 410, [68, 70, 58])
  };
}

function averageRegion(image, x0, y0, x1, y1, fallback) {
  const samples = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
        continue;
      }
      const offset = (y * image.width + x) * 4;
      const alpha = image.data[offset + 3];
      if (alpha < 80) {
        continue;
      }
      const rgb = [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
      const lum = luminance(rgb);
      if (lum < 42 || lum > 238) {
        continue;
      }
      samples.push(rgb);
    }
  }
  if (samples.length === 0) {
    return fallback;
  }
  const total = samples.reduce(
    (sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]],
    [0, 0, 0]
  );
  return total.map((value) => clampByte(value / samples.length));
}

function buildContactSheet(outputs) {
  const sheetWidth = 620;
  const sheetHeight = 960;
  const data = new Uint8Array(sheetWidth * sheetHeight * 4);
  for (let y = 0; y < sheetHeight; y += 1) {
    for (let x = 0; x < sheetWidth; x += 1) {
      const noise = watercolorNoise(x, y, 313);
      const offset = (y * sheetWidth + x) * 4;
      data[offset] = clampByte(232 + (noise - 0.5) * 10);
      data[offset + 1] = clampByte(222 + (noise - 0.5) * 8);
      data[offset + 2] = clampByte(201 + (noise - 0.5) * 7);
      data[offset + 3] = 255;
    }
  }

  const cells = [
    { x: 42, y: 42 },
    { x: 340, y: 42 },
    { x: 42, y: 500 },
    { x: 340, y: 500 }
  ];

  outputs.forEach((output, index) => {
    const cell = cells[index];
    drawCell(data, sheetWidth, sheetHeight, cell.x, cell.y, output.label);
    paste(data, sheetWidth, sheetHeight, output.image, cell.x + 44, cell.y + 30);
  });

  return data;
}

function drawCell(data, width, height, x, y, label) {
  for (let yy = 0; yy < 408; yy += 1) {
    for (let xx = 0; xx < 238; xx += 1) {
      const edge = xx < 2 || yy < 2 || xx >= 236 || yy >= 406;
      blendPixel(data, width, x + xx, y + yy, edge ? [68, 63, 48] : [219, 205, 174], edge ? 0.72 : 0.18);
    }
  }
  drawTinyLabel(data, width, x + 15, y + 13, label);
}

function drawTinyLabel(data, width, x, y, text) {
  const glyphs = {
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"]
  };
  const glyph = glyphs[text];
  for (let gy = 0; gy < glyph.length; gy += 1) {
    for (let gx = 0; gx < glyph[gy].length; gx += 1) {
      if (glyph[gy][gx] !== "1") {
        continue;
      }
      for (let yy = 0; yy < 3; yy += 1) {
        for (let xx = 0; xx < 3; xx += 1) {
          blendPixel(data, width, x + gx * 3 + xx, y + gy * 3 + yy, [39, 36, 28], 0.88);
        }
      }
    }
  }
}

function paste(target, targetWidth, targetHeight, image, x0, y0) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceOffset = (y * image.width + x) * 4;
      const alpha = image.data[sourceOffset + 3] / 255;
      if (alpha <= 0) {
        continue;
      }
      blendPixel(
        target,
        targetWidth,
        x0 + x,
        y0 + y,
        [image.data[sourceOffset], image.data[sourceOffset + 1], image.data[sourceOffset + 2]],
        alpha
      );
    }
  }
}

function blendPixel(data, width, x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= data.length / width / 4) {
    return;
  }
  const offset = (y * width + x) * 4;
  const destAlpha = data[offset + 3] / 255;
  const outAlpha = alpha + destAlpha * (1 - alpha);
  if (outAlpha <= 0) {
    return;
  }
  data[offset] = clampByte((rgb[0] * alpha + data[offset] * destAlpha * (1 - alpha)) / outAlpha);
  data[offset + 1] = clampByte((rgb[1] * alpha + data[offset + 1] * destAlpha * (1 - alpha)) / outAlpha);
  data[offset + 2] = clampByte((rgb[2] * alpha + data[offset + 2] * destAlpha * (1 - alpha)) / outAlpha);
  data[offset + 3] = clampByte(outAlpha * 255);
}

function insideEllipse(x, y, cx, cy, rx, ry, angle) {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = x - cx;
  const dy = y - cy;
  const ex = dx * cos - dy * sin;
  const ey = dx * sin + dy * cos;
  return (ex * ex) / (rx * rx) + (ey * ey) / (ry * ry) <= 1;
}

function watercolorNoise(x, y, seed) {
  return (
    noise2(x * 0.035, y * 0.035, seed) * 0.52 +
    noise2(x * 0.08 + 3.7, y * 0.07 - 1.9, seed + 11) * 0.31 +
    noise2(x * 0.19 - 2.1, y * 0.16 + 4.2, seed + 23) * 0.17
  );
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

function luminance(rgb) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
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
