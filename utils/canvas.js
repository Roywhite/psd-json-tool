'use strict';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * 加载 Node.js 下可用的 Canvas 绑定。
 * 优先使用 @napi-rs/canvas，其次回退到 canvas。
 * @returns {{ createCanvas: Function, loadImage: Function }}
 */
export function loadCanvasBindings() {
  try {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    return { createCanvas, loadImage };
  } catch (_) {
    try {
      const { createCanvas, loadImage } = require('canvas');
      return { createCanvas, loadImage };
    } catch (err) {
      throw new Error('Canvas bindings not found. Please install "@napi-rs/canvas" or "canvas"');
    }
  }
}

/**
 * 初始化 ag-psd 在 Node.js 环境下的画布支持。
 * 内部使用同步的 loadImage 实现，不支持返回 Promise 的实现。
 */
export function initializeAgPsdCanvas() {
  const helpers = require('ag-psd/dist/helpers');
  if (typeof helpers.initializeCanvas !== 'function') return;
  const { createCanvas, loadImage } = loadCanvasBindings();

  const createCanvasMethod = (width, height) => createCanvas(width, height);

  const createCanvasFromDataMethod = (data) => {
    // ag-psd 期望 JPEG 字节；这里通过 dataURI 同步构造图像
    const base64 = Buffer.from(data).toString('base64');
    const src = 'data:image/jpeg;base64,' + base64;
    const image = loadImage(src);
    if (image && typeof image.then === 'function') {
      throw new Error('Synchronous loadImage required but got Promise. Use @napi-rs/canvas >=0.1.44 or install canvas package.');
    }
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return canvas;
  };

  const createImageDataMethod = (width, height) => {
    const canvas = createCanvas(1, 1);
    return canvas.getContext('2d').createImageData(width, height);
  };

  helpers.initializeCanvas(createCanvasMethod, createCanvasFromDataMethod, createImageDataMethod);
}


