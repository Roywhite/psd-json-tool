'use strict';

import { toBase64, fromBase64ToBuffer } from './crypto.js';
import { isPlainObject, typedArrayNames, nameToTypedArray } from './typed.js';

/**
 * JSON 序列化：自动序列化 ArrayBuffer/TypedArray 为可还原对象
 */
export function serializeWithTypedArrays(key, value) {
  if (value instanceof ArrayBuffer) {
    return { __typedarray: 'ArrayBuffer', base64: toBase64(value) };
  }
  if (ArrayBuffer.isView(value)) {
    const name = typedArrayNames.get(value.constructor);
    if (name) {
      return { __typedarray: name, base64: toBase64(value) };
    }
  }
  return value;
}

/**
 * JSON 反序列化：将 serializeWithTypedArrays 的输出还原为原始类型
 */
export function deserializeWithTypedArrays(key, value) {
  if (isPlainObject(value) && typeof value.__typedarray === 'string' && typeof value.base64 === 'string') {
    if (value.__typedarray === 'ArrayBuffer') {
      const buf = fromBase64ToBuffer(value.base64);
      const copied = Buffer.from(buf).buffer.slice(0);
      return copied;
    }
    const Ctor = nameToTypedArray[value.__typedarray];
    if (Ctor) {
      const buf = fromBase64ToBuffer(value.base64);
      return new Ctor(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / Ctor.BYTES_PER_ELEMENT));
    }
  }
  return value;
}

/**
 * 递归稳定排序对象键，确保字符串化结果稳定
 */
export function sortDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === 'object') {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return value;
    }
    const sorted = {};
    Object.keys(value).sort().forEach((k) => {
      sorted[k] = sortDeep(value[k]);
    });
    return sorted;
  }
  return value;
}

/**
 * 稳定 JSON 字符串化（带 typed arrays 支持）
 */
export function stableStringify(value) {
  return JSON.stringify(sortDeep(value), serializeWithTypedArrays);
}


