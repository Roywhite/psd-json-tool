'use strict';

import fs from 'fs';
import path from 'path';
import { readPsd, writePsd } from 'ag-psd';
import { PNG } from 'pngjs';
import { initializeAgPsdCanvas } from './canvas.js';
import { ensureDir, isCanvasLike, isImageDataLike, nodeBufferFrom, writePngFromCanvas, writePngFromImageData, readImageDataFromPng } from './images.js';
import { computeSha256Hex } from './crypto.js';
import { stableStringify } from './json.js';
import { typedArrayNames, nameToTypedArray } from './typed.js';
import { getDefaults } from './config.js';

/**
 * 将 PSD 对象中的二进制/图像内容写入到 images 目录，并替换为 JSON 可描述占位对象。
 *
 * 规则：
 * - Canvas/ImageData 会另存为 PNG，并记录尺寸/sha；
 * - ArrayBuffer/TypedArray/Buffer 会打包进 1xN PNG，记录类型/sha/长度；
 * - 普通对象与数组递归处理，其他类型原样返回。
 *
 * @param {any} psdObject PSD 对象（来自 ag-psd 的读入对象）
 * @param {string} assetsDirAbs 资源输出目录（绝对路径）
 * @returns {any} 可序列化的 JSON 对象
 */
export function externalizePsd(psdObject, assetsDirAbs) {
  const imagesDir = assetsDirAbs;
  ensureDir(imagesDir);

  const seen = new Map();

  function ext(value) {
    if (Array.isArray(value)) return value.map(ext);
    if (value && typeof value === 'object') {
      if (isCanvasLike(value)) {
        const { rel, sha, width, height } = writePngFromCanvas(value, imagesDir);
        return { __image: rel, __sha256: sha, width, height, __type: 'Canvas' };
      }
      if (isImageDataLike(value)) {
        const { rel, sha } = writePngFromImageData(value, imagesDir);
        return { __image: rel, __sha256: sha, width: value.width, height: value.height, __type: 'ImageData' };
      }
      if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || Buffer.isBuffer(value)) {
        const buf = nodeBufferFrom(value);
        const sha = computeSha256Hex(buf);
        let rel = seen.get(sha);
        if (!rel) {
          const pixels = Math.ceil(buf.byteLength / 4);
          const png = new PNG({ width: Math.max(pixels, 1), height: 1 });
          png.data.fill(0);
          buf.copy(png.data, 0, 0, buf.byteLength);
          const out = PNG.sync.write(png, { colorType: 6 });
          const file = `${sha}.png`;
          const abs = path.join(imagesDir, file);
          if (!fs.existsSync(abs)) fs.writeFileSync(abs, out);
          rel = file;
          seen.set(sha, rel);
        }
        const name = value instanceof ArrayBuffer ? 'ArrayBuffer' : typedArrayNames.get(value.constructor) || 'Buffer';
        return { __image: rel, __sha256: sha, __typedarray: name, __byteLength: buf.byteLength, __kind: 'Raw' };
      }
      const out = {};
      for (const k of Object.keys(value)) out[k] = ext(value[k]);
      return out;
    }
    return value;
  }

  return ext(psdObject);
}

/**
 * 将 externalize 后的 JSON 结构还原为 ag-psd 可接受的结构（ImageData 等）。
 *
 * - Canvas/ImageData：从 PNG 还原像素；
 * - 原始字节：从 1xN PNG 还原为 ArrayBuffer/TypedArray/Buffer；
 *
 * @param {any} jsonSafePsd Externalize 后的 JSON 对象
 * @param {string} assetsDirAbs 资源目录（绝对路径）
 * @returns {any} 适配 ag-psd 的对象
 */
export function hydratePsd(jsonSafePsd, assetsDirAbs) {
  function hyd(value) {
    if (Array.isArray(value)) return value.map(hyd);
    if (value && typeof value === 'object') {
      if (value.__image && value.__type === 'Canvas') {
        const abs = path.join(assetsDirAbs, value.__image.replace(/\\/g, '/'));
        const img = readImageDataFromPng(abs);
        if ((img.width !== value.width) || (img.height !== value.height)) {
          throw new Error(`PNG dimension mismatch for ${value.__image}`);
        }
        return img;
      }
      if (value.__image && value.__type === 'ImageData') {
        const abs = path.join(assetsDirAbs, value.__image.replace(/\\/g, '/'));
        const img = readImageDataFromPng(abs);
        if ((img.width !== value.width) || (img.height !== value.height)) {
          throw new Error(`PNG dimension mismatch for ${value.__image}`);
        }
        return img;
      }
      if (value.__image && value.__typedarray && value.__kind === 'Raw') {
        const abs = path.join(assetsDirAbs, value.__image.replace(/\\/g, '/'));
        const file = fs.readFileSync(abs);
        const png = PNG.sync.read(file);
        const raw = Buffer.from(png.data);
        if (value.__sha256) {
          const recon = raw.slice(0, value.__byteLength);
          const sha = computeSha256Hex(recon);
          if (sha !== value.__sha256) throw new Error(`Raw png sha256 mismatch for ${value.__image}`);
        }
        const recon = raw.slice(0, value.__byteLength);
        if (value.__typedarray === 'ArrayBuffer' || value.__typedarray === 'Buffer') {
          return recon.buffer.slice(recon.byteOffset, recon.byteOffset + recon.byteLength);
        }
        const Ctor = nameToTypedArray[value.__typedarray];
        if (!Ctor) throw new Error(`Unknown typed array: ${value.__typedarray}`);
        return new Ctor(recon.buffer, recon.byteOffset, Math.floor(recon.byteLength / Ctor.BYTES_PER_ELEMENT));
      }
      const out = {};
      for (const k of Object.keys(value)) out[k] = hyd(value[k]);
      return out;
    }
    return value;
  }

  return hyd(jsonSafePsd);
}

/**
 * 从 PSD 路径读入，输出 JSON 容器并写出图片到 assets 目录。
 *
 * @param {string} inputPath PSD 文件路径
 * @param {{ output?: string, outputDir?: string, assetsDirName?: string }} [optionsOrOutputPath]
 * @returns {{ absOut: string }} 输出 JSON 的绝对路径
 */
export function psdToJson(inputPath, optionsOrOutputPath) {
  const absIn = path.resolve(process.cwd(), inputPath);
  const baseName = path.basename(absIn, path.extname(absIn));
  const options = (typeof optionsOrOutputPath === 'string')
    ? { output: optionsOrOutputPath }
    : (optionsOrOutputPath && typeof optionsOrOutputPath === 'object' ? optionsOrOutputPath : {});
  const defaults = getDefaults();
  const outputDir = options.outputDir || defaults.outputDir;
  const assetsDirName = options.assetsDirName || defaults.assetsDirName;
  const resultDir = path.resolve(process.cwd(), outputDir);
  const absOut = options.output
    ? path.resolve(process.cwd(), options.output)
    : path.resolve(process.cwd(), path.join(outputDir, baseName + '.json'));
  // 资源目录优先级：options.assetsDir（相对则基于输出 JSON 所在目录）> 默认 outputDir/assetsDirName
  let imagesDirAbs = path.join(resultDir, assetsDirName);
  if (typeof options.assetsDir === 'string' && options.assetsDir) {
    imagesDirAbs = path.isAbsolute(options.assetsDir)
      ? options.assetsDir
      : path.resolve(path.dirname(absOut), options.assetsDir);
  }
  const assetsDir = imagesDirAbs;

  const buffer = fs.readFileSync(absIn);
  initializeAgPsdCanvas();
  const psd = readPsd(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

  ensureDir(assetsDir);
  ensureDir(resultDir);
  ensureDir(imagesDirAbs);

  const container = {
    __meta: {
      tool: 'psd-json-tool',
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      inputFileName: path.basename(absIn),
      inputSize: buffer.byteLength,
      // 写入相对 JSON 的资源目录，便于整体移动
      assetsDir: path.relative(path.dirname(absOut), assetsDir).replace(/\\/g, '/') || '.'
    },
    psd: externalizePsd(psd, assetsDir)
  };

  const psdStable = stableStringify(container.psd);
  container.__meta.psdCanonicalSha256 = computeSha256Hex(Buffer.from(psdStable, 'utf8'));

  const jsonText = JSON.stringify(container, null, 2);
  fs.writeFileSync(absOut, jsonText);
  return { absOut };
}

/**
 * 从 JSON 容器还原并写出 PSD。
 *
 * @param {string} inputPath JSON 文件路径
 * @param {{ output?: string, outputDir?: string }} [optionsOrOutputPath]
 * @returns {{ absOut: string }} 输出 PSD 的绝对路径
 */
export function jsonToPsd(inputPath, optionsOrOutputPath) {
  const absIn = path.resolve(process.cwd(), inputPath);
  const jsonText = fs.readFileSync(absIn, 'utf8');
  const container = JSON.parse(jsonText);

  if (!container || typeof container !== 'object') {
    throw new Error('Invalid container JSON');
  }

  const psd = container.psd;
  if (!psd) throw new Error('JSON does not contain field "psd"');

  const baseName = path.basename(absIn, path.extname(absIn));
  const options = (typeof optionsOrOutputPath === 'string')
    ? { output: optionsOrOutputPath }
    : (optionsOrOutputPath && typeof optionsOrOutputPath === 'object' ? optionsOrOutputPath : {});
  const defaults = getDefaults();
  const outputDir = options.outputDir || defaults.outputDir;
  const resultDir = path.resolve(process.cwd(), outputDir);
  const absOut = options.output
    ? path.resolve(process.cwd(), options.output)
    : path.resolve(process.cwd(), path.join(outputDir, baseName + '.psd'));

  // 资源目录来源优先级：
  // 1) options.assetsDir（相对则基于输入 JSON 所在目录）
  // 2) JSON.__meta.assetsDir（相对 JSON 的目录）
  // 3) 默认值 defaults.assetsDirName（位于 JSON 同级目录）
  let assetsDir = path.resolve(
    path.dirname(absIn),
    container.__meta && container.__meta.assetsDir ? container.__meta.assetsDir : defaults.assetsDirName
  );
  if (typeof options.assetsDir === 'string' && options.assetsDir) {
    assetsDir = path.isAbsolute(options.assetsDir)
      ? options.assetsDir
      : path.resolve(path.dirname(absIn), options.assetsDir);
  }
  try { fs.mkdirSync(resultDir, { recursive: true }); } catch (_) {}

  initializeAgPsdCanvas();

  const hydrated = hydratePsd(psd, assetsDir);

  (function normalizeCanvasToImageData(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(normalizeCanvasToImageData); return; }
    if (node.canvas && node.canvas.width && node.canvas.height && node.canvas.data && !node.canvas.getContext) {
      if (!node.imageData) node.imageData = node.canvas;
      delete node.canvas;
    }
    for (const k of Object.keys(node)) normalizeCanvasToImageData(node[k]);
  })(hydrated);

  const arrayBuffer = writePsd(hydrated);
  const nodeBuffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(absOut, nodeBuffer);

  return { absOut };
}


