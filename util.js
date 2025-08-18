'use strict';

import fs from 'fs';
import path from 'path';
// 聚合层仅做导入与导出，具体实现位于 utils/*
import { initializeAgPsdCanvas } from './utils/canvas.js';
import { ensureDir } from './utils/images.js';
import { computeSha256Hex, toBase64, fromBase64ToBuffer } from './utils/crypto.js';
import { stableStringify } from './utils/json.js';
import { psdToJson, jsonToPsd, externalizePsd, hydratePsd, updateLayersWithSpec } from './utils/psd-io.js';
import { getDefaults, setDefaults, loadConfig, loadConfigAuto } from './utils/config.js';

/**
 * 统一聚合导出入口（ESM）。
 * - 默认导出 `Util`：包含常用方法集合
 * - 具名导出：`convert`、`psdToJson`、`jsonToPsd`、以及若干工具函数
 *
 * 约定：所有 API 为同步 I/O（fs.readFileSync / writeFileSync），便于脚本使用；
 * 如果需要异步版本，可在外层自行封装 `await fs.promises.*`。
 */

// 初始化逻辑见 utils/canvas.js

// 实用工具统一由 utils/* 提供

// externalizePsd/hydratePsd 已在 utils/psd-io.js 内实现

// -------------------------
// Public API: psd <-> json
// -------------------------
// psdToJson/jsonToPsd 已在 utils/psd-io.js 内实现

/**
 * 自动识别输入类型并执行转换。
 * - 当输入为 .psd：执行 PSD -> JSON；
 * - 当输入为 .json：执行 JSON -> PSD。
 *
 * @param {string} input 文件路径或文件名
 * @param {{ output?: string, outputDir?: string, assetsDirName?: string }} [options]
 *  - output: 输出文件的完整路径（优先级最高）
 *  - outputDir: 未指定 output 时使用的输出目录（默认 'result'）
 *  - assetsDirName: PSD->JSON 时图片资源的子目录名（默认 'images'），写入 JSON 的 __meta.assetsDir
 * @returns {{ absOut: string }} 输出文件的绝对路径
 */
function convert(input, options = {}) {
  const tryPaths = [
    path.resolve(process.cwd(), input),
    path.resolve(process.cwd(), 'images', input),
    path.resolve(process.cwd(), 'result', input)
  ];
  const absIn = tryPaths.find((p) => fs.existsSync(p)) || path.resolve(process.cwd(), input);
  const ext = path.extname(absIn).toLowerCase();
  if (ext === '.psd') {
    return psdToJson(absIn, options);
  }
  if (ext === '.json') {
    return jsonToPsd(absIn, options);
  }
  throw new Error('Unsupported input. Provide .psd or .json');
}

const Util = {
  initializeAgPsdCanvas,
  ensureDir,
  externalizePsd,
  hydratePsd,
  computeSha256Hex,
  stableStringify,
  toBase64,
  fromBase64ToBuffer,
  psdToJson,
  jsonToPsd,
  convert,
  updateLayersWithSpec,
  // 配置相关
  getDefaults,
  configure: setDefaults,
  loadConfig,
  loadConfigAuto
};

export {
  Util,
  initializeAgPsdCanvas,
  ensureDir,
  externalizePsd,
  hydratePsd,
  computeSha256Hex,
  stableStringify,
  toBase64,
  fromBase64ToBuffer,
  psdToJson,
  jsonToPsd,
  convert,
  updateLayersWithSpec,
  getDefaults,
  setDefaults as configure,
  loadConfig,
  loadConfigAuto
};

export default Util;


