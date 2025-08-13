'use strict';

import fs from 'fs';
import path from 'path';

// 包级默认配置（可通过 configure 修改）
let DEFAULTS = {
  outputDir: 'result',
  assetsDirName: 'images'
};

/** 读取当前默认配置（返回副本） */
export function getDefaults() {
  return { ...DEFAULTS };
}

/** 合并更新默认配置 */
export function setDefaults(partial) {
  if (!partial || typeof partial !== 'object') return;
  DEFAULTS = { ...DEFAULTS, ...partial };
}

/**
 * 从 JSON 文件加载配置（同步）。
 * 仅读取以下字段：outputDir, assetsDirName
 */
export function loadConfig(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return false;
  const txt = fs.readFileSync(abs, 'utf8');
  try {
    const obj = JSON.parse(txt);
    const next = {};
    if (typeof obj.outputDir === 'string') next.outputDir = obj.outputDir;
    if (typeof obj.assetsDirName === 'string') next.assetsDirName = obj.assetsDirName;
    setDefaults(next);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 在当前工作目录自动查找 psdjson.config.json 并加载（若存在）。
 */
export function loadConfigAuto() {
  const cfg = path.resolve(process.cwd(), 'psdjson.config.json');
  return loadConfig(cfg);
}


