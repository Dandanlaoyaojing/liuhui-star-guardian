import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const projectRoot = new URL("..", import.meta.url).pathname;
const sourcePath = join(projectRoot, "assets/art/stage1-tools/M02-flashlight.png");
const runtimePath = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/m01-single-flashlight-tool-runtime-fixed.png"
);
const syncTargets = [
  join(projectRoot, "assets/resources/art/stage1-m01/runtime-sprites/surfaces/m01-single-flashlight-tool.png"),
  join(projectRoot, "assets/art/stage1-m01/m01-single-flashlight-tool.png"),
  runtimePath,
  join(projectRoot, "docs/design/generated-m01-art-slices/m01-generated-watercolor-psd-assets/parts/flashlight_single_three_buttons.png")
];

const TARGET = { width: 198, height: 437 };
const TARGET_PADDING = 5;
const SOURCE_MARGIN = 10;

const source = isolateForeground(readPng(sourcePath));
const alphaBounds = findAlphaBounds(source, 10);
const crop = expandBounds(alphaBounds, SOURCE_MARGIN, source.width, source.height);
const scale = Math.min(
  (TARGET.width - TARGET_PADDING * 2) / crop.width,
  (TARGET.height - TARGET_PADDING * 2) / crop.height
);
const scaled = {
  width: crop.width * scale,
  height: crop.height * scale,
  x: (TARGET.width - crop.width * scale) / 2,
  y: (TARGET.height - crop.height * scale) / 2
};
const output = resampleToCanvas(source, crop, scaled, TARGET.width, TARGET.height);
const detected = {
  buttons: {
    red: detectRuntimeButton(output, TARGET.width, TARGET.height, "red"),
    yellow: detectRuntimeButton(output, TARGET.width, TARGET.height, "yellow"),
    blue: detectRuntimeButton(output, TARGET.width, TARGET.height, "blue")
  },
  lens: sourcePointToRuntimePoint(detectLens(source, alphaBounds), crop, scaled)
};

for (const target of syncTargets) {
  writePng(target, TARGET.width, TARGET.height, output);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      sourcePath,
      runtimePath,
      syncTargets,
      sourceSize: { width: source.width, height: source.height },
      alphaBounds,
      crop,
      scaled,
      runtimePoints: detected
    },
    null,
    2
  )
);

function findAlphaBounds(image, threshold) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha <= threshold) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("Source image has no visible alpha.");
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function isolateForeground(image) {
  const output = {
    width: image.width,
    height: image.height,
    data: new Uint8Array(image.data)
  };
  clearEdgeConnectedBackground(output);
  keepLargestVisibleComponent(output);
  return output;
}

function clearEdgeConnectedBackground(image) {
  const seen = new Uint8Array(image.width * image.height);
  const queue = [];

  for (let x = 0; x < image.width; x += 1) {
    enqueueBackgroundPixel(image, seen, queue, x, 0);
    enqueueBackgroundPixel(image, seen, queue, x, image.height - 1);
  }
  for (let y = 0; y < image.height; y += 1) {
    enqueueBackgroundPixel(image, seen, queue, 0, y);
    enqueueBackgroundPixel(image, seen, queue, image.width - 1, y);
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const [x, y] = queue[queueIndex];
    image.data[(y * image.width + x) * 4 + 3] = 0;

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      enqueueBackgroundPixel(image, seen, queue, x + dx, y + dy);
    }
  }
}

function enqueueBackgroundPixel(image, seen, queue, x, y) {
  if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
    return;
  }
  const index = y * image.width + x;
  if (seen[index]) {
    return;
  }
  if (!isBackgroundPixel(image, x, y)) {
    return;
  }
  seen[index] = 1;
  queue.push([x, y]);
}

function isBackgroundPixel(image, x, y) {
  const offset = (y * image.width + x) * 4;
  const r = image.data[offset];
  const g = image.data[offset + 1];
  const b = image.data[offset + 2];
  const a = image.data[offset + 3];
  return a <= 10 || (r <= 18 && g <= 18 && b <= 18);
}

function keepLargestVisibleComponent(image) {
  const seen = new Uint8Array(image.width * image.height);
  let largest = [];

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = y * image.width + x;
      if (seen[index] || !isVisiblePixel(image, x, y)) {
        continue;
      }

      const component = collectVisibleComponent(image, seen, x, y);
      if (component.length > largest.length) {
        largest = component;
      }
    }
  }

  const keep = new Uint8Array(image.width * image.height);
  for (const index of largest) {
    keep[index] = 1;
  }

  for (let index = 0; index < keep.length; index += 1) {
    if (!keep[index]) {
      image.data[index * 4 + 3] = 0;
    }
  }
}

function collectVisibleComponent(image, seen, startX, startY) {
  const queue = [[startX, startY]];
  const component = [];
  seen[startY * image.width + startX] = 1;

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const [x, y] = queue[queueIndex];
    component.push(y * image.width + x);

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextX >= image.width || nextY < 0 || nextY >= image.height) {
        continue;
      }
      const nextIndex = nextY * image.width + nextX;
      if (seen[nextIndex] || !isVisiblePixel(image, nextX, nextY)) {
        continue;
      }
      seen[nextIndex] = 1;
      queue.push([nextX, nextY]);
    }
  }

  return component;
}

function isVisiblePixel(image, x, y) {
  return image.data[(y * image.width + x) * 4 + 3] > 10;
}

function expandBounds(bounds, margin, width, height) {
  const x = Math.max(0, bounds.x - margin);
  const y = Math.max(0, bounds.y - margin);
  const maxX = Math.min(width, bounds.x + bounds.width + margin);
  const maxY = Math.min(height, bounds.y + bounds.height + margin);
  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y
  };
}

function resampleToCanvas(image, crop, scaled, targetWidth, targetHeight) {
  const output = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = crop.x + (x - scaled.x) / scale;
      const sourceY = crop.y + (y - scaled.y) / scale;
      if (
        sourceX < crop.x ||
        sourceY < crop.y ||
        sourceX >= crop.x + crop.width ||
        sourceY >= crop.y + crop.height
      ) {
        continue;
      }
      const rgba = sampleBilinear(image, sourceX, sourceY);
      const offset = (y * targetWidth + x) * 4;
      output[offset] = rgba[0];
      output[offset + 1] = rgba[1];
      output[offset + 2] = rgba[2];
      output[offset + 3] = rgba[3];
    }
  }

  return output;
}

function sampleBilinear(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const top = mixPremultiplied(readPixel(image, x0, y0), readPixel(image, x1, y0), tx);
  const bottom = mixPremultiplied(readPixel(image, x0, y1), readPixel(image, x1, y1), tx);
  return unpremultiply(mixPremultiplied(top, bottom, ty));
}

function readPixel(image, x, y) {
  const offset = (y * image.width + x) * 4;
  const alpha = image.data[offset + 3] / 255;
  return [
    image.data[offset] * alpha,
    image.data[offset + 1] * alpha,
    image.data[offset + 2] * alpha,
    image.data[offset + 3]
  ];
}

function mixPremultiplied(a, b, t) {
  return [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t,
    a[3] * (1 - t) + b[3] * t
  ];
}

function unpremultiply(pixel) {
  const alpha = pixel[3] / 255;
  if (alpha <= 0) {
    return [0, 0, 0, 0];
  }
  return [
    clampByte(pixel[0] / alpha),
    clampByte(pixel[1] / alpha),
    clampByte(pixel[2] / alpha),
    clampByte(pixel[3])
  ];
}

function sourcePointToRuntimePoint(point, crop, scaled) {
  return {
    x: scaled.x + (point.x - crop.x) * scale,
    y: scaled.y + (point.y - crop.y) * scale
  };
}

function detectLens(image, bounds) {
  const maxY = bounds.y + bounds.height * 0.42;
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let y = bounds.y; y < Math.ceil(maxY); y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      const a = image.data[offset + 3];
      const warmLens = a > 80 && r > 128 && g > 95 && b > 60;
      const weight = warmLens ? luminance(r, g, b) - 80 : 0;
      if (weight <= 0) {
        continue;
      }
      totalWeight += weight;
      weightedX += x * weight;
      weightedY += y * weight;
    }
  }

  if (totalWeight <= 0) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * 0.16 };
  }

  return { x: weightedX / totalWeight, y: weightedY / totalWeight };
}

function detectRuntimeButton(data, width, height, color) {
  const seen = new Uint8Array(width * height);
  const components = [];
  const minX = Math.floor(width * 0.25);
  const maxX = Math.ceil(width * 0.75);
  const maxY = Math.ceil(height * 0.92);

  for (let y = 0; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const index = y * width + x;
      if (seen[index] || !isRuntimeButtonPixel(data, width, x, y, color)) {
        continue;
      }

      const queue = [[x, y]];
      seen[index] = 1;
      let count = 0;
      let sumX = 0;
      let sumY = 0;

      for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const [currentX, currentY] = queue[queueIndex];
        count += 1;
        sumX += currentX;
        sumY += currentY;

        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          if (nextX < minX || nextX >= maxX || nextY < 0 || nextY >= maxY) {
            continue;
          }
          const nextIndex = nextY * width + nextX;
          if (seen[nextIndex] || !isRuntimeButtonPixel(data, width, nextX, nextY, color)) {
            continue;
          }
          seen[nextIndex] = 1;
          queue.push([nextX, nextY]);
        }
      }

      components.push({ count, x: sumX / count, y: sumY / count });
    }
  }

  const largest = components.sort((left, right) => right.count - left.count)[0];
  if (!largest) {
    throw new Error(`Unable to detect ${color} runtime button in generated flashlight.`);
  }

  return { x: largest.x, y: largest.y };
}

function isRuntimeButtonPixel(data, width, x, y, color) {
  const offset = (y * width + x) * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  if (color === "red") {
    return a > 100 && r > 145 && g < 115 && b < 95 && r > g * 1.35 && r > b * 1.5;
  }
  if (color === "yellow") {
    return a > 100 && r > 145 && g > 120 && b < 95 && Math.abs(r - g) < 80 && r > b * 1.7 && g > b * 1.5;
  }
  return a > 100 && b > 125 && r < 105 && g < 155 && b > r * 1.45 && b > g * 1.1;
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

  writeFileSync(
    path,
    Buffer.concat([
      signature,
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0))
    ])
  );
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

function luminance(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
