import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const projectRoot = new URL("..", import.meta.url).pathname;
const referencePath =
  process.argv[2] ??
  join(
    projectRoot,
    "docs/design/generated-m01-art-slices/final-puzzle-piece-textures/m01-puzzle-piece-color-pattern-reference.png"
  );
const directGreyHiddenSourcePath = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/m01-direct-grey-hidden-pieces-source.png"
);
const directPieceSliceRoot = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/final-puzzle-piece-textures/direct-piece-slices"
);

const sheetPath = join(
  projectRoot,
  "docs/design/generated-m01-art-slices/m01-reference-style-pieces-contact-sheet.png"
);
const fragmentRoot = join(
  projectRoot,
  "assets/resources/art/stage1-m01/runtime-sprites/fragments"
);
const hiddenRoot = join(
  projectRoot,
  "assets/resources/art/stage1-m01/runtime-sprites/hidden-fragments"
);

const size = 112;
const scale = 3;
const ss = size * scale;
const cellWidth = 150;
const cellHeight = 138;
const labelHeight = 22;
const columns = 3;
const rows = 7;

const colorSpecs = [
  { id: "hidden", label: "hidden", directSlice: true, folder: hiddenRoot },
  { id: "red", label: "red", directSlice: true, folder: fragmentRoot },
  { id: "blue", label: "blue", directSlice: true, folder: fragmentRoot },
  { id: "yellow", label: "yellow", directSlice: true, folder: fragmentRoot },
  { id: "purple", label: "purple", directSlice: true, folder: fragmentRoot },
  { id: "orange", label: "orange", directSlice: true, folder: fragmentRoot },
  { id: "green", label: "green", directSlice: true, folder: fragmentRoot }
];

const shapes = [
  { id: "circle", label: "circle" },
  { id: "triangle", label: "triangle" },
  { id: "hexagon", label: "hexagon" }
];

const directGreyHiddenCropBoxes = {
  circle: { x: 459, y: 448, size: 332 },
  triangle: { x: 84, y: 434, size: 334 },
  hexagon: { x: 852, y: 446, size: 338 }
};

const reference = readPng(referencePath);
const directGreyHiddenSource = readPng(directGreyHiddenSourcePath);
const referenceSamples = buildReferenceSamples(reference);
const textureRegions = buildTextureRegions(reference);
const colors = colorSpecs.map((color) => ({
  ...color,
  rgb: color.directSlice ? undefined : color.rgb ?? averageTextureRegionColor(color.texture)
}));
const sprites = new Map();

for (const color of colors) {
  for (const shape of shapes) {
    const sprite = renderPiece(color, shape);
    addCocosTrimGuard(sprite.data, sprite.width, sprite.height);
    sprites.set(`${color.id}_${shape.id}`, sprite);

    const filename =
      color.id === "hidden"
        ? `m01-fragment-hidden-${shape.id}.png`
        : `m01-fragment-${color.id}-${shape.id}.png`;
    writePng(join(color.folder, filename), sprite.width, sprite.height, sprite.data);
  }
}

writePng(sheetPath, cellWidth * columns, cellHeight * rows, buildContactSheet());

console.log(
  JSON.stringify(
    {
      ok: true,
      referencePath,
      directGreyHiddenSourcePath,
      sheetPath,
      runtimeSprites: sprites.size
    },
    null,
    2
  )
);

function renderPiece(color, shape) {
  if (color.directSlice) {
    return renderDirectPieceSlice(color.id, shape.id);
  }

  const high = new Uint8Array(ss * ss * 4);
  const seed = hash(`${color.id}:${shape.id}:m01-user-reference-style-v1`);
  const blobs = makeBlobs(seed, color.id === "hidden" ? 13 : 16);

  for (let y = 0; y < ss; y += 1) {
    for (let x = 0; x < ss; x += 1) {
      const nx = (x + 0.5) / scale;
      const ny = (y + 0.5) / scale;
      const sd = shapeSignedDistance(shape.id, nx, ny);
      const wobble = (noise2(nx * 0.23, ny * 0.23, seed + 31) - 0.5) * 1.2;
      const contour = sd + wobble;
      const offset = (y * ss + x) * 4;

      if (contour > 1.8) {
        high[offset + 3] = 0;
        continue;
      }

      const strokeBand =
        Math.abs(contour) < 2.15 + noise2(nx * 0.41, ny * 0.41, seed + 7) * 0.8 ||
        (contour > -3.35 && contour < -2.5 && noise2(nx * 0.9, ny * 0.9, seed + 17) > 0.62);

      if (strokeBand) {
        const broken = noise2(nx * 1.7, ny * 1.7, seed + 19) > 0.88 ? 18 : 0;
        high[offset] = 29 + broken;
        high[offset + 1] = 27 + broken;
        high[offset + 2] = 21 + Math.floor(broken * 0.7);
        high[offset + 3] = 255;
        continue;
      }

      if (contour > -0.3) {
        high[offset + 3] = 0;
        continue;
      }

      const referencePaper = sampleReferencePaper(nx, ny, seed);
      const sourceTexture = sampleTexture(color.texture, nx, ny, seed);
      const inkCloud =
        0.48 * noise2(nx * 0.045, ny * 0.045, seed + 101) +
        0.34 * noise2(nx * 0.085 + 2.7, ny * 0.085 - 4.3, seed + 103) +
        0.18 * noise2(nx * 0.18 - 3.1, ny * 0.18 + 1.9, seed + 107);
      const cloud = clamp(sourceTexture.strength * 0.22 + inkCloud * 0.78, 0, 1);
      const fiber = noise2(nx * 0.82, ny * 0.38, seed + 109) - 0.5;
      const stain = blobField(blobs, nx, ny);
      const edge = clamp((-contour) / 14, 0, 1);
      const edgePool = (1 - edge) * (0.13 + 0.09 * noise2(nx * 0.42, ny * 0.42, seed + 113));
      const blossom = smoothstep(0.08, 0.24, 1 - cloud) * 0.08;
      const paper = mixRgb(referencePaper, [222, 211, 184], 1 - color.paper);
      const pigmentStrength = clamp(
        color.pigment + (cloud - 0.5) * 0.12 + stain * 0.18 + edgePool - blossom * 0.25,
        0.3,
        0.66
      );
      const mapped = colorizeReferenceTexture(sourceTexture.rgb, sourceTexture.averageLuminance, paper, color.rgb, pigmentStrength);
      const material = mapped;
      const darkPool = stain * 10 + edgePool * 18 + sourceTexture.darkness * 4;
      const lightLift = blossom * 7 + sourceTexture.lightness * 3;

      high[offset] = clampByte(material[0] - darkPool + lightLift + fiber * 2.2);
      high[offset + 1] = clampByte(material[1] - darkPool + lightLift + fiber * 1.8);
      high[offset + 2] = clampByte(material[2] - darkPool + lightLift + fiber * 1.4);
      high[offset + 3] = 255;
    }
  }

  const sprite = downsampleOpaque(high, ss, ss, size, size);
  forceOpaqueBoundary(sprite);
  return sprite;
}

function renderDirectPieceSlice(colorId, shapeId) {
  const source = readPng(directPieceSlicePath(colorId, shapeId));
  const bounds = opaquePixelBounds(source);
  const data = new Uint8Array(size * size * 4);
  const targetAspect = directPieceTargetAspect(shapeId);
  const cropWidth = bounds.width;
  const cropHeight = bounds.height * targetAspect;
  const centerX = (bounds.minX + bounds.maxX + 1) / 2;
  const centerY = (bounds.minY + bounds.maxY + 1) / 2;
  const cropX = centerX - cropWidth / 2;
  const cropY = centerY - cropHeight / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = cropX + ((x + 0.5) / size) * cropWidth;
      const sy = cropY + ((y + 0.5) / size) * cropHeight;
      const sampled = sampleRgbaBilinear(source, sx, sy);
      const offset = (y * size + x) * 4;
      data[offset] = sampled[0];
      data[offset + 1] = sampled[1];
      data[offset + 2] = sampled[2];
      data[offset + 3] = sampled[3] >= 32 ? 255 : 0;
    }
  }
  thickenDirectPieceOutline(data, size, size);
  addCocosTrimGuard(data, size, size);

  return { width: size, height: size, data };
}

function directPieceTargetAspect(shapeId) {
  if (shapeId === "circle") {
    return 1;
  }

  return 2 / Math.sqrt(3);
}

function directPieceSlicePath(colorId, shapeId) {
  return join(directPieceSliceRoot, `m01-final-fragment-${colorId}-${shapeId}.png`);
}

function opaquePixelBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] < 24) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("Direct piece slice has no opaque pixels");
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function renderDirectGreyHiddenPiece(shape) {
  const crop = directGreyHiddenCropBoxes[shape.id];
  if (!crop) {
    throw new Error(`Missing direct grey crop box for shape: ${shape.id}`);
  }

  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = crop.x + ((x + 0.5) / size) * crop.size;
      const sy = crop.y + ((y + 0.5) / size) * crop.size;
      const sampled = sampleBilinear(directGreyHiddenSource, sx, sy);
      const offset = (y * size + x) * 4;
      data[offset] = sampled[0];
      data[offset + 1] = sampled[1];
      data[offset + 2] = sampled[2];
      data[offset + 3] = 255;
    }
  }

  const outlineBarrier = dilateMask(buildDarkOutlineMask(data, size, size), size, size, 1);
  const background = floodFillBackground(outlineBarrier, size, size);
  for (let offset = 0; offset < data.length; offset += 4) {
    const pixel = offset / 4;
    data[offset + 3] = background[pixel] ? 0 : 255;
  }
  trimLightPaperHalo(data, size, size, 8);
  addCocosTrimGuard(data, size, size);

  return { width: size, height: size, data };
}

function addCocosTrimGuard(data, width, height) {
  for (const [x, y] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ]) {
    data[(y * width + x) * 4 + 3] = 2;
  }
}

function thickenDirectPieceOutline(data, width, height) {
  const ink = [7, 7, 6];
  const radius = 6.2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 24) {
        continue;
      }

      const distance = nearestTransparentDistance(data, width, height, x, y, Math.ceil(radius));
      if (distance > radius) {
        continue;
      }

      const fade = Math.pow((radius - distance) / radius, 0.78);
      const strength = clamp(fade * 0.88, 0, 0.9);
      data[offset] = clampByte(data[offset] * (1 - strength) + ink[0] * strength);
      data[offset + 1] = clampByte(data[offset + 1] * (1 - strength) + ink[1] * strength);
      data[offset + 2] = clampByte(data[offset + 2] * (1 - strength) + ink[2] * strength);
    }
  }
}

function nearestTransparentDistance(data, width, height, x, y, radius) {
  let nearest = Infinity;
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) {
        nearest = Math.min(nearest, Math.hypot(xx - x, yy - y));
        continue;
      }
      if (data[(yy * width + xx) * 4 + 3] >= 24) {
        continue;
      }
      nearest = Math.min(nearest, Math.hypot(xx - x, yy - y));
    }
  }
  return nearest;
}

function buildDarkOutlineMask(data, width, height) {
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const lum = luminance(r, g, b);
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum < 98 || (lum < 122 && spread < 54)) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}

function dilateMask(mask, width, height, radius) {
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let active = false;
      for (let yy = -radius; yy <= radius && !active; yy += 1) {
        for (let xx = -radius; xx <= radius; xx += 1) {
          const px = x + xx;
          const py = y + yy;
          if (px < 0 || py < 0 || px >= width || py >= height) {
            continue;
          }
          if (mask[py * width + px]) {
            active = true;
            break;
          }
        }
      }
      output[y * width + x] = active ? 1 : 0;
    }
  }
  return output;
}

function floodFillBackground(barrier, width, height) {
  const background = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const index = y * width + x;
    if (background[index] || barrier[index]) {
      return;
    }
    background[index] = 1;
    stack.push([x, y]);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return background;
}

function trimLightPaperHalo(data, width, height, maxPasses) {
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const remove = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 16 || !touchesTransparent(data, width, height, x, y)) {
          continue;
        }
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const lum = luminance(r, g, b);
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        if (lum > 120 && spread < 80) {
          remove.push(offset);
        }
      }
    }

    if (remove.length === 0) {
      return;
    }
    for (const offset of remove) {
      data[offset + 3] = 0;
    }
  }
}

function touchesTransparent(data, width, height, x, y) {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1]
  ].some(([px, py]) => {
    if (px < 0 || py < 0 || px >= width || py >= height) {
      return true;
    }
    return data[(py * width + px) * 4 + 3] < 16;
  });
}

function buildContactSheet() {
  const width = cellWidth * columns;
  const height = cellHeight * rows;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const paper = sampleReferencePaper(x * 0.35, y * 0.35, 91);
      const offset = (y * width + x) * 4;
      data[offset] = clampByte(paper[0] + 6);
      data[offset + 1] = clampByte(paper[1] + 8);
      data[offset + 2] = clampByte(paper[2] + 9);
      data[offset + 3] = 255;
    }
  }

  for (let row = 0; row < colors.length; row += 1) {
    for (let column = 0; column < shapes.length; column += 1) {
      const color = colors[row];
      const shape = shapes[column];
      const sprite = sprites.get(`${color.id}_${shape.id}`);
      const x0 = column * cellWidth + Math.floor((cellWidth - size) / 2);
      const y0 = row * cellHeight + 4;
      blit(data, width, sprite, x0, y0);
      drawLabel(data, width, height, `${color.label}_${shape.label}`, column * cellWidth + 12, row * cellHeight + size + 9);
    }
  }

  return data;
}

function buildReferenceSamples(image) {
  const samples = [];
  const preferred = [
    [0.06, 0.09, 0.92, 0.19],
    [0.08, 0.72, 0.9, 0.95],
    [0.07, 0.18, 0.31, 0.64],
    [0.64, 0.08, 0.93, 0.22],
    [0.18, 0.08, 0.42, 0.18],
    [0.13, 0.81, 0.86, 0.93]
  ];

  for (const [x0p, y0p, x1p, y1p] of preferred) {
    const x0 = Math.floor(image.width * x0p);
    const y0 = Math.floor(image.height * y0p);
    const x1 = Math.floor(image.width * x1p);
    const y1 = Math.floor(image.height * y1p);
    for (let y = y0; y < y1; y += 5) {
      for (let x = x0; x < x1; x += 5) {
        const offset = (y * image.width + x) * 4;
        const r = image.data[offset];
        const g = image.data[offset + 1];
        const b = image.data[offset + 2];
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        if (luminance > 135 && luminance < 238 && spread < 82 && r >= b && g >= b - 8) {
          samples.push([r, g, b]);
        }
      }
    }
  }

  return samples.length > 50 ? samples : [[220, 208, 180], [207, 194, 165], [232, 220, 192]];
}

function buildTextureRegions(image) {
  const regions = {
    hidden_circle: [
      rect(image, 0.25, 0.43, 0.42, 0.68),
      rect(image, 0.59, 0.2, 0.73, 0.48)
    ],
    hidden_triangle: [
      rect(image, 0.36, 0.2, 0.47, 0.49),
      rect(image, 0.56, 0.49, 0.67, 0.72)
    ],
    hidden_hexagon: [
      rect(image, 0.42, 0.58, 0.55, 0.82),
      rect(image, 0.47, 0.27, 0.59, 0.53)
    ],
    hidden: [
      rect(image, 0.6, 0.2, 0.71, 0.47),
      rect(image, 0.27, 0.45, 0.39, 0.68),
      rect(image, 0.45, 0.29, 0.57, 0.5),
      rect(image, 0.41, 0.63, 0.54, 0.8)
    ],
    purple: [
      rect(image, 0.34, 0.41, 0.4, 0.48),
      rect(image, 0.59, 0.31, 0.64, 0.49)
    ],
    orange: [
      rect(image, 0.46, 0.35, 0.51, 0.49),
      rect(image, 0.51, 0.62, 0.56, 0.7)
    ],
    green: [
      rect(image, 0.39, 0.6, 0.42, 0.72),
      rect(image, 0.54, 0.5, 0.59, 0.56)
    ]
  };

  return Object.fromEntries(
    Object.entries(regions).map(([key, entries]) => [
      key,
      entries.map((entry) => ({
        ...entry,
        averageLuminance: averageRegionLuminance(image, entry)
      }))
    ])
  );
}

function rect(image, x0, y0, x1, y1) {
  return {
    x: Math.floor(image.width * x0),
    y: Math.floor(image.height * y0),
    width: Math.max(1, Math.floor(image.width * (x1 - x0))),
    height: Math.max(1, Math.floor(image.height * (y1 - y0)))
  };
}

function averageRegionLuminance(image, region) {
  let sum = 0;
  let count = 0;
  for (let y = region.y; y < region.y + region.height; y += 4) {
    for (let x = region.x; x < region.x + region.width; x += 4) {
      const [r, g, b] = sampleImage(image, x, y);
      const lum = luminance(r, g, b);
      if (lum > 45 && lum < 235) {
        sum += lum;
        count += 1;
      }
    }
  }
  return count > 0 ? sum / count : 150;
}

function averageTextureRegionColor(key) {
  const regions = textureRegions[key] ?? textureRegions.hidden;
  const samples = [];

  for (const region of regions) {
    for (let y = region.y; y < region.y + region.height; y += 3) {
      for (let x = region.x; x < region.x + region.width; x += 3) {
        const sample = sampleSoftReference(reference, x, y);
        const lum = luminance(sample[0], sample[1], sample[2]);
        const spread = Math.max(...sample) - Math.min(...sample);
        if (lum > 70 && lum < 220 && spread > 12) {
          samples.push(sample);
        }
      }
    }
  }

  return samples.length > 0 ? averageRgb(samples) : [128, 118, 98];
}

function sampleTexture(key, x, y, seed) {
  const regions = textureRegions[key] ?? textureRegions.hidden;
  const region = regions[Math.floor(rand(seed + Math.floor(x * 3) + Math.floor(y * 5)) * regions.length) % regions.length];
  const warpX = (noise2(x * 0.045, y * 0.045, seed + 301) - 0.5) * 0.18;
  const warpY = (noise2(x * 0.052, y * 0.052, seed + 307) - 0.5) * 0.18;
  const u = fract(x / 112 + warpX + rand(seed + 313) * 0.73);
  const v = fract(y / 112 + warpY + rand(seed + 317) * 0.73);
  let sx = region.x + u * (region.width - 1);
  let sy = region.y + v * (region.height - 1);
  let rgb = sampleSoftReference(reference, sx, sy);
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const lum = luminance(rgb[0], rgb[1], rgb[2]);
    const spread = Math.max(...rgb) - Math.min(...rgb);
    if (lum > 82 && !(lum < region.averageLuminance - 55 && spread < 55)) {
      break;
    }
    sx = region.x + fract(u + rand(seed + attempt * 11) * 0.47) * (region.width - 1);
    sy = region.y + fract(v + rand(seed + attempt * 13) * 0.47) * (region.height - 1);
    rgb = sampleSoftReference(reference, sx, sy);
  }
  const lum = luminance(rgb[0], rgb[1], rgb[2]);
  const delta = (lum - region.averageLuminance) / 80;

  return {
    rgb,
    averageLuminance: region.averageLuminance,
    strength: clamp(0.5 + delta * 0.55, 0, 1),
    darkness: clamp(-delta, 0, 1),
    lightness: clamp(delta, 0, 1)
  };
}

function sampleSoftReference(image, x, y) {
  const center = sampleImage(image, x, y);
  const left = sampleImage(image, x - 2, y);
  const right = sampleImage(image, x + 2, y);
  const up = sampleImage(image, x, y - 2);
  const down = sampleImage(image, x, y + 2);
  return [
    (center[0] * 2 + left[0] + right[0] + up[0] + down[0]) / 6,
    (center[1] * 2 + left[1] + right[1] + up[1] + down[1]) / 6,
    (center[2] * 2 + left[2] + right[2] + up[2] + down[2]) / 6
  ];
}

function averageRgb(samples) {
  const total = samples.reduce(
    (sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]],
    [0, 0, 0]
  );
  return [total[0] / samples.length, total[1] / samples.length, total[2] / samples.length];
}

function sampleImage(image, x, y) {
  const ix = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const offset = (iy * image.width + ix) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

function sampleBilinear(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const top = mixSample(sampleImage(image, x0, y0), sampleImage(image, x1, y0), tx);
  const bottom = mixSample(sampleImage(image, x0, y1), sampleImage(image, x1, y1), tx);
  return mixSample(top, bottom, ty);
}

function sampleRgbaBilinear(image, x, y) {
  if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1) {
    return [0, 0, 0, 0];
  }

  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const top = mixRgbaSample(readRgbaPixel(image, x0, y0), readRgbaPixel(image, x1, y0), tx);
  const bottom = mixRgbaSample(readRgbaPixel(image, x0, y1), readRgbaPixel(image, x1, y1), tx);
  return mixRgbaSample(top, bottom, ty);
}

function readRgbaPixel(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3]
  ];
}

function mixSample(a, b, t) {
  return [
    clampByte(a[0] * (1 - t) + b[0] * t),
    clampByte(a[1] * (1 - t) + b[1] * t),
    clampByte(a[2] * (1 - t) + b[2] * t)
  ];
}

function mixRgbaSample(a, b, t) {
  return [
    clampByte(a[0] * (1 - t) + b[0] * t),
    clampByte(a[1] * (1 - t) + b[1] * t),
    clampByte(a[2] * (1 - t) + b[2] * t),
    clampByte(a[3] * (1 - t) + b[3] * t)
  ];
}

function colorizeReferenceTexture(source, averageLuminance, paper, pigment, pigmentStrength) {
  const sourceLum = luminance(source[0], source[1], source[2]);
  const shade = clamp(1 + (sourceLum - averageLuminance) / 520, 0.88, 1.1);
  const base = [
    paper[0] * (1 - pigmentStrength) + pigment[0] * pigmentStrength,
    paper[1] * (1 - pigmentStrength) + pigment[1] * pigmentStrength,
    paper[2] * (1 - pigmentStrength) + pigment[2] * pigmentStrength
  ];
  const sourceWarmth = [
    (source[0] - sourceLum) * 0.035,
    (source[1] - sourceLum) * 0.03,
    (source[2] - sourceLum) * 0.025
  ];

  return [
    base[0] * shade + sourceWarmth[0],
    base[1] * shade + sourceWarmth[1],
    base[2] * shade + sourceWarmth[2]
  ];
}

function sampleReferencePaper(x, y, seed) {
  const index = Math.floor(
    noise2(x * 0.021 + seed * 0.001, y * 0.021 - seed * 0.001, seed + 211) *
      referenceSamples.length
  );
  const base = referenceSamples[Math.min(referenceSamples.length - 1, index)];
  const wash = noise2(x * 0.08, y * 0.08, seed + 223) - 0.5;
  const fiber = noise2(x * 1.2, y * 0.7, seed + 227) - 0.5;
  return [
    clampByte(base[0] + wash * 22 + fiber * 7),
    clampByte(base[1] + wash * 18 + fiber * 6),
    clampByte(base[2] + wash * 12 + fiber * 5)
  ];
}

function makeBlobs(seed, count) {
  return Array.from({ length: count }, (_, index) => ({
    x: 8 + rand(seed + index * 17) * 96,
    y: 8 + rand(seed + index * 19) * 96,
    radius: 10 + rand(seed + index * 23) * 24,
    strength: 0.18 + rand(seed + index * 29) * 0.46
  }));
}

function blobField(blobs, x, y) {
  let value = 0;
  for (const blob of blobs) {
    const dx = x - blob.x;
    const dy = y - blob.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    value += smoothstep(blob.radius, blob.radius * 0.25, distance) * blob.strength;
  }
  return clamp(value, 0, 1);
}

function shapeSignedDistance(shape, x, y) {
  if (shape === "circle") {
    return Math.hypot(x - 56, y - 56) - 52;
  }

  if (shape === "triangle") {
    return polygonSignedDistance(
      [
        [56, 2],
        [110, 108],
        [2, 108]
      ],
      x,
      y
    );
  }

  return polygonSignedDistance(
    [
      [56, 1],
      [108, 29],
      [108, 83],
      [56, 111],
      [4, 83],
      [4, 29]
    ],
    x,
    y
  );
}

function polygonSignedDistance(points, x, y) {
  let inside = false;
  let minDistance = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }

    const distance = pointSegmentDistance(x, y, xi, yi, xj, yj);
    minDistance = Math.min(minDistance, distance);
  }
  return inside ? -minDistance : minDistance;
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function downsampleOpaque(source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const data = new Uint8Array(targetWidth * targetHeight * 4);
  const factorX = sourceWidth / targetWidth;
  const factorY = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = Math.floor(y * factorY); sy < Math.floor((y + 1) * factorY); sy += 1) {
        for (let sx = Math.floor(x * factorX); sx < Math.floor((x + 1) * factorX); sx += 1) {
          const offset = (sy * sourceWidth + sx) * 4;
          r += source[offset];
          g += source[offset + 1];
          b += source[offset + 2];
          a += source[offset + 3];
          count += 1;
        }
      }
      const offset = (y * targetWidth + x) * 4;
      const averageAlpha = a / count;
      if (averageAlpha < 120) {
        data[offset + 3] = 0;
      } else {
        data[offset] = clampByte(r / count);
        data[offset + 1] = clampByte(g / count);
        data[offset + 2] = clampByte(b / count);
        data[offset + 3] = clampByte(averageAlpha);
      }
    }
  }

  return { width: targetWidth, height: targetHeight, data };
}

function forceOpaqueBoundary(sprite) {
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const offset = (y * sprite.width + x) * 4;
      if (sprite.data[offset + 3] < 16) {
        continue;
      }

      const touchesTransparentOutside = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
      ].some(([px, py]) => {
        if (px < 0 || py < 0 || px >= sprite.width || py >= sprite.height) {
          return true;
        }
        return sprite.data[(py * sprite.width + px) * 4 + 3] < 16;
      });

      if (touchesTransparentOutside) {
        sprite.data[offset + 3] = 255;
      }
    }
  }
}

function blit(target, targetWidth, sprite, x0, y0) {
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const sourceOffset = (y * sprite.width + x) * 4;
      const alpha = sprite.data[sourceOffset + 3] / 255;
      if (alpha <= 0) {
        continue;
      }
      const targetOffset = ((y0 + y) * targetWidth + x0 + x) * 4;
      target[targetOffset] = clampByte(sprite.data[sourceOffset] * alpha + target[targetOffset] * (1 - alpha));
      target[targetOffset + 1] = clampByte(sprite.data[sourceOffset + 1] * alpha + target[targetOffset + 1] * (1 - alpha));
      target[targetOffset + 2] = clampByte(sprite.data[sourceOffset + 2] * alpha + target[targetOffset + 2] * (1 - alpha));
      target[targetOffset + 3] = 255;
    }
  }
}

function drawLabel(data, width, height, text, x, y) {
  const glyphs = tinyGlyphs();
  let cursor = x;
  for (const char of text) {
    const glyph = glyphs[char] ?? glyphs["?"];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] !== "1") {
          continue;
        }
        drawRect(data, width, height, cursor + gx * 2, y + gy * 2, 2, 2, [42, 36, 27, 230]);
      }
    }
    cursor += (glyph[0].length + 1) * 2;
  }
}

function drawRect(data, width, height, x, y, rectWidth, rectHeight, color) {
  for (let yy = 0; yy < rectHeight; yy += 1) {
    for (let xx = 0; xx < rectWidth; xx += 1) {
      const px = x + xx;
      const py = y + yy;
      if (px < 0 || py < 0 || px >= width || py >= height) {
        continue;
      }
      const offset = (py * width + px) * 4;
      const alpha = color[3] / 255;
      data[offset] = clampByte(color[0] * alpha + data[offset] * (1 - alpha));
      data[offset + 1] = clampByte(color[1] * alpha + data[offset + 1] * (1 - alpha));
      data[offset + 2] = clampByte(color[2] * alpha + data[offset + 2] * (1 - alpha));
      data[offset + 3] = 255;
    }
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
  const targetStride = width * 4;
  const data = new Uint8Array(width * height * 4);
  let sourceOffset = 0;
  const unfiltered = new Uint8Array(width * height * channels);

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
      const targetPixel = y * targetStride + x * 4;
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

function rand(seed) {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) % 100000) / 100000;
}

function rand2(x, y, seed) {
  return rand((x * 374761393 + y * 668265263 + seed * 2147483647) | 0);
}

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgb(a, b, t) {
  return [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t
  ];
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function fract(value) {
  return value - Math.floor(value);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function tinyGlyphs() {
  return {
    _: ["000", "000", "000", "000", "111"],
    "?": ["111", "001", "011", "000", "010"],
    a: ["010", "101", "111", "101", "101"],
    b: ["110", "101", "110", "101", "110"],
    c: ["011", "100", "100", "100", "011"],
    d: ["110", "101", "101", "101", "110"],
    e: ["111", "100", "110", "100", "111"],
    g: ["011", "100", "101", "101", "011"],
    h: ["101", "101", "111", "101", "101"],
    i: ["111", "010", "010", "010", "111"],
    l: ["100", "100", "100", "100", "111"],
    n: ["101", "111", "111", "111", "101"],
    o: ["010", "101", "101", "101", "010"],
    p: ["110", "101", "110", "100", "100"],
    r: ["110", "101", "110", "101", "101"],
    t: ["111", "010", "010", "010", "010"],
    u: ["101", "101", "101", "101", "111"],
    w: ["101", "101", "111", "111", "101"],
    y: ["101", "101", "010", "010", "010"]
  };
}
