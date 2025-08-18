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
 * 从 externalize 之后的 PSD 结构中提取图层信息（id/name/image），保持 children 嵌套。
 * @param {any} psdExternalized externalizePsd(psd) 的结果
 * @param {string} assetsDirRel 写入 JSON 所在目录相对的资源目录（container.__meta.assetsDir）
 * @returns {Array<{ id: string|number, name: string, image: string, children?: any[] }>} 顶层图层数组
 */
function buildLayerInfo(psdExternalized, assetsDirRel) {
  const joinPath = (p) => (assetsDirRel && assetsDirRel !== '.') ? (assetsDirRel.replace(/\\/g, '/') + '/' + p) : p;
  let autoId = 1;

  function pickImage(node) {
    if (node && typeof node === 'object') {
      if (node.canvas && node.canvas.__image) return node.canvas.__image;
      if (node.imageData && node.imageData.__image) return node.imageData.__image;
    }
    return '';
  }

  function detectType(node) {
    if (!node || typeof node !== 'object') return 'layer';
    if (Array.isArray(node.children) && node.children.length > 0) return 'group';
    if (node.text && typeof node.text === 'object') return 'text';
    if (node.smartObject && typeof node.smartObject === 'object') return 'smartObject';
    if (node.adjustment) return 'adjustment';
    if (node.vectorMask || node.path || node.shape || node.strokeStyle || node.fill || node.gradientMap) return 'shape';
    if (node.canvas || node.imageData) return 'pixel';
    return 'layer';
  }

  function mapLayer(node) {
    const id = (node && (typeof node.id === 'string' || typeof node.id === 'number')) ? node.id : autoId++;
    const name = (node && typeof node.name === 'string') ? node.name : '';
    
    // 优先使用节点中已有的 type 字段，如果没有则自动检测
    let type = node.type;
    if (!type) {
      type = detectType(node);
    }
    
    const imageRel = pickImage(node);
    const out = { id, name, type };
    
    // 优先使用节点中已有的 image 字段，如果没有则从 canvas/imageData 中提取
    if (node.image) {
      out.image = node.image;
    } else if (imageRel) {
      out.image = joinPath(imageRel);
    }
    
    if (Array.isArray(node && node.children) && node.children.length > 0) {
      out.children = node.children.map(mapLayer);
    }
    return out;
  }

  const children = Array.isArray(psdExternalized && psdExternalized.children) ? psdExternalized.children : [];
  return children.map(mapLayer);
}

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

  // 额外输出图层信息 JSON（只包含 id、name、image、children）
  try {
    const layerInfo = buildLayerInfo(container.psd, container.__meta.assetsDir);
    const absLayersOut = path.resolve(path.dirname(absOut), path.basename(absOut, path.extname(absOut)) + '.layers.json');
    const layerJson = JSON.stringify(layerInfo, null, 2);
    fs.writeFileSync(absLayersOut, layerJson);
  } catch (e) {
    // 尽量不影响主流程
  }
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


/**
 * updateLayersWithSpec：传入单个对象，有 id 的调整层级，无 id 的新增，
 * 没有 children 的 group 类型被移除，结果保存到 layers.json 和 test.json
 * 注意：只更新 spec 中指定的图层，其他图层保持不变
 *
 * @param {string} containerJsonPath 例如 'result/test.json'
 * @param {string} layersJsonPath 例如 'result/test.layers.json'
 * @param {Object} spec 单个对象：{ id?, name?, type?, children? }
 * @returns {{ absOut: string, newLayersAbsOut: string }}
 */
export function updateLayersWithSpec(containerJsonPath, layersJsonPath, spec) {
  const absContainer = path.resolve(process.cwd(), containerJsonPath);
  const absLayers = path.resolve(process.cwd(), layersJsonPath);

  const container = JSON.parse(fs.readFileSync(absContainer, 'utf8'));
  if (!container || typeof container !== 'object' || !container.psd) {
    throw new Error('Invalid container JSON: missing psd');
  }
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid spec: expected an object');
  }

  // id -> 原始节点
  const idToNode = new Map();
  let maxId = 0;
  (function index(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(index); return; }
    if (node.id !== undefined) {
      const idNum = Number(node.id);
      if (!Number.isNaN(idNum)) maxId = Math.max(maxId, idNum);
      idToNode.set(String(node.id), node);
    }
    if (Array.isArray(node.children)) node.children.forEach(index);
  })(container.psd.children || []);

  function allocateId() {
    maxId += 1;
    return maxId;
  }

  // 递归处理 spec，有 id 的调整层级，无 id 的新增
  const usedIds = new Set();
   
  function rebuildFromSpec(nodeSpec) {
    let real;
    
    if (nodeSpec.id !== undefined && idToNode.has(String(nodeSpec.id))) {
      // 有 id 且存在：复用并调整层级
      real = idToNode.get(String(nodeSpec.id));
      usedIds.add(String(nodeSpec.id));
      
      // 更新名称（如果提供）
      if (typeof nodeSpec.name === 'string') {
        real.name = nodeSpec.name;
      }
    } else {
      // 无 id：新增节点，保留所有传入的字段
      const newId = allocateId();
      usedIds.add(String(newId));
      real = { 
        id: newId,
        ...nodeSpec  // 保留所有传入的字段
      };
      // 确保 id 是我们分配的值
      real.id = newId;
    }
    
    // 处理 children
    if (Array.isArray(nodeSpec.children) && nodeSpec.children.length > 0) {
      const newChildren = nodeSpec.children.map(rebuildFromSpec);
      // 过滤：没有 children 的 group 类型被移除
      const filteredChildren = newChildren.filter(child => {
        if (child.type === 'group' && (!child.children || child.children.length === 0)) {
          return false; // 移除空的 group
        }
        return true;
      });
      
      if (filteredChildren.length > 0) {
        real.children = filteredChildren;
      } else {
        delete real.children;
      }
    } else {
      delete real.children;
    }
    
    return real;
  }

  // 验证：第一层必须有 id
  if (spec.id === undefined) {
    throw new Error('第一层节点必须提供 id 字段');
  }
  if (!idToNode.has(String(spec.id))) {
    throw new Error(`指定的 id ${spec.id} 在容器中不存在`);
  }

  // 保持原有位置：只更新 spec 中指定的图层，其他图层位置不变
  const targetId = String(spec.id);
  const target = idToNode.get(targetId);
  
  // 更新名称（如果提供）
  if (typeof spec.name === 'string') {
    target.name = spec.name;
  }
  
  // 处理 children
  if (Array.isArray(spec.children) && spec.children.length > 0) {
    const newChildren = spec.children.map(rebuildFromSpec);
    // 过滤：没有 children 的 group 类型被移除
    const filteredChildren = newChildren.filter(child => {
      if (child.type === 'group' && (!child.children || child.children.length === 0)) {
        return false; // 移除空的 group
      }
      return true;
    });
    
    if (filteredChildren.length > 0) {
      target.children = filteredChildren;
    } else {
      delete target.children;
    }
  } else {
    delete target.children;
  }

  // 不需要重新构建整个 children 数组，保持原有结构

  // 写回 container 并更新 sha
  const psdStable = stableStringify(container.psd);
  container.__meta = container.__meta || {};
  container.__meta.psdCanonicalSha256 = computeSha256Hex(Buffer.from(psdStable, 'utf8'));
  fs.writeFileSync(absContainer, JSON.stringify(container, null, 2));

  // 同步写回 layers.json：重新生成，确保完整一致
  // 但是要保留 spec 中指定的 type、image 等信息
  const layersOut = buildLayerInfo(container.psd, container.__meta && container.__meta.assetsDir ? container.__meta.assetsDir : '.');
   
  // 将 spec 中的自定义字段（type、image 等）合并到生成的 layers.json 中
  function mergeSpecInfo(layersArray, specNode) {
    if (!Array.isArray(layersArray) || !specNode || typeof specNode !== 'object') return layersArray;
    
    // 递归遍历并更新 layers 数组
    function updateLayersRecursive(layers, spec) {
      if (!Array.isArray(layers) || !spec) return layers;
      
      return layers.map(layer => {
        const updated = { ...layer };
        
        // 如果是目标节点，合并 spec 中的字段
        if (layer.id === spec.id) {
          if (spec.type !== undefined) updated.type = spec.type;
          if (spec.image !== undefined) updated.image = spec.image;
          if (spec.name !== undefined) updated.name = spec.name;
          
          // 递归处理 children
          if (Array.isArray(spec.children) && Array.isArray(layer.children)) {
            updated.children = updateLayersRecursive(layer.children, spec.children);
          }
        }
        
        // 递归处理 children（即使没有对应的 spec）
        if (Array.isArray(layer.children)) {
          updated.children = updateLayersRecursive(layer.children, spec);
        }
        
        return updated;
      });
    }
    
    // 递归处理 spec 的 children 数组
    function updateSpecChildren(layers, specChildren) {
      if (!Array.isArray(layers) || !Array.isArray(specChildren)) return layers;
      
      return layers.map(layer => {
        const updated = { ...layer };
        
        // 递归处理 children
        if (Array.isArray(layer.children)) {
          updated.children = updateSpecChildren(layer.children, specChildren);
        }
        
        return updated;
      });
    }
    
    // 先处理第一层
    let result = updateLayersRecursive(layersArray, specNode);
    
    // 再递归处理 spec 的 children
    if (Array.isArray(specNode.children)) {
      result = updateSpecChildren(result, specNode.children);
    }
    
    return result;
  }
   
  const finalLayersOut = mergeSpecInfo(layersOut, spec);
  fs.writeFileSync(absLayers, JSON.stringify(finalLayersOut, null, 2));

  return { absOut: absContainer, newLayersAbsOut: absLayers };
}


