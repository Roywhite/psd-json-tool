'use strict';

import crypto from 'crypto';

/**
 * 计算输入内容的 SHA-256 十六进制字符串
 * @param {Buffer|ArrayBuffer|ArrayBufferView|string} bufferLike
 * @returns {string}
 */
export function computeSha256Hex(bufferLike) {
  const hash = crypto.createHash('sha256');
  if (Buffer.isBuffer(bufferLike)) {
    hash.update(bufferLike);
  } else if (bufferLike instanceof ArrayBuffer) {
    hash.update(Buffer.from(bufferLike));
  } else if (ArrayBuffer.isView(bufferLike)) {
    hash.update(Buffer.from(bufferLike.buffer, bufferLike.byteOffset, bufferLike.byteLength));
  } else if (typeof bufferLike === 'string') {
    hash.update(Buffer.from(bufferLike, 'utf8'));
  } else {
    throw new Error('Unsupported input to computeSha256Hex');
  }
  return hash.digest('hex');
}

/**
 * Base64 编码工具：支持 Buffer/ArrayBuffer/TypedArray
 * @param {Buffer|ArrayBuffer|ArrayBufferView} bufferOrTypedArray
 * @returns {string}
 */
export function toBase64(bufferOrTypedArray) {
  if (Buffer.isBuffer(bufferOrTypedArray)) {
    return bufferOrTypedArray.toString('base64');
  }
  if (bufferOrTypedArray instanceof ArrayBuffer) {
    return Buffer.from(bufferOrTypedArray).toString('base64');
  }
  if (ArrayBuffer.isView(bufferOrTypedArray)) {
    return Buffer.from(bufferOrTypedArray.buffer, bufferOrTypedArray.byteOffset, bufferOrTypedArray.byteLength).toString('base64');
  }
  throw new Error('toBase64 expects Buffer | ArrayBuffer | TypedArray');
}

/**
 * Base64 转 Buffer
 * @param {string} base64
 * @returns {Buffer}
 */
export function fromBase64ToBuffer(base64) {
  return Buffer.from(base64, 'base64');
}


