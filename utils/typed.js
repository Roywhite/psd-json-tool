'use strict';

/**
 * 判断是否为普通对象
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export const typedArrayNames = new Map([
  [Int8Array, 'Int8Array'],
  [Uint8Array, 'Uint8Array'],
  [Uint8ClampedArray, 'Uint8ClampedArray'],
  [Int16Array, 'Int16Array'],
  [Uint16Array, 'Uint16Array'],
  [Int32Array, 'Int32Array'],
  [Uint32Array, 'Uint32Array'],
  [Float32Array, 'Float32Array'],
  [Float64Array, 'Float64Array'],
  [BigInt64Array, 'BigInt64Array'],
  [BigUint64Array, 'BigUint64Array']
]);

export const nameToTypedArray = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array
};


