'use strict';

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { computeSha256Hex } from './crypto.js';

/**
 * 确保目录存在
 */
export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 转换到 Node.js Buffer
 */
export function nodeBufferFrom(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error('Expected Buffer | ArrayBuffer | TypedArray');
}

/** 判定 ImageData-like */
export function isImageDataLike(obj) {
  return obj && typeof obj === 'object' && typeof obj.width === 'number' && typeof obj.height === 'number'
    && obj.data && (obj.data instanceof Uint8ClampedArray || obj.data instanceof Uint8Array)
    && obj.data.length === obj.width * obj.height * 4;
}

/** 判定 Canvas-like */
export function isCanvasLike(obj) {
  return obj && typeof obj === 'object'
    && typeof obj.width === 'number' && typeof obj.height === 'number'
    && typeof obj.getContext === 'function'
    && typeof obj.toBuffer === 'function';
}

/**
 * 将 ImageData 写为 PNG，并返回相对路径与 sha
 */
export function writePngFromImageData(imageData, imagesDir) {
  const { width, height, data } = imageData;
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const sha = computeSha256Hex(buf);
  const file = `${sha}.png`;
  const abs = path.join(imagesDir, file);
  if (!fs.existsSync(abs)) {
    const png = new PNG({ width, height });
    png.data = Buffer.from(buf);
    const out = PNG.sync.write(png, { colorType: 6 });
    fs.writeFileSync(abs, out);
  }
  return { rel: file, sha };
}

/**
 * 将 Canvas 写为 PNG，并返回相对路径与 sha
 */
export function writePngFromCanvas(canvas, imagesDir) {
  const width = canvas.width;
  const height = canvas.height;
  const out = canvas.toBuffer('image/png');
  const sha = computeSha256Hex(out);
  const file = `${sha}.png`;
  const abs = path.join(imagesDir, file);
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, out);
  return { rel: file, sha, width, height };
}

/**
 * 从 PNG 读取 ImageData-like
 */
export function readImageDataFromPng(absPath) {
  const file = fs.readFileSync(absPath);
  const png = PNG.sync.read(file, { skipRescale: false });
  const data = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength);
  return { width: png.width, height: png.height, data };
}


