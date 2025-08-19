// TypeScript 声明文件（ESM）
// 为 js 用户提供智能提示；实际实现位于 ESM 源码中

export interface ConvertOptions {
	output?: string;
	outputDir?: string;
	assetsDirName?: string;
	assetsDir?: string; // 资源目录（绝对或相对输出 JSON 目录）
}

export interface PsdtJsonOptions {
	output?: string;
	outputDir?: string;
	assetsDirName?: string;
    assetsDir?: string; // 资源目录（绝对或相对输出 JSON 目录）
}

export interface JsonToPsdOptions {
	output?: string;
	outputDir?: string;
    assetsDir?: string; // 指定资源目录（绝对或相对 JSON 目录），优先级最高
}

export interface ConvertResult {
	absOut: string;
}

export interface UpdateLayersResult {
	absOut: string;
	newLayersAbsOut: string;
}

// 图层规范节点类型
export interface LayerSpecNode {
	id?: string | number;  // 第一层必须提供，子层可选
	name?: string;
	type?: string;
	image?: string;
	children?: LayerSpecNode[];
	[key: string]: any; // 允许其他自定义字段
}

export function initializeAgPsdCanvas(): void;
export function ensureDir(dir: string): void;
export function externalizePsd(psd: any, assetsDir: string): any;
export function hydratePsd(json: any, assetsDir: string): any;
export function computeSha256Hex(bufferLike: Buffer | ArrayBuffer | ArrayBufferView | string): string;
export function toBase64(input: Buffer | ArrayBuffer | ArrayBufferView): string;
export function fromBase64ToBuffer(base64: string): Buffer;
export function stableStringify(value: unknown): string;

export function psdToJson(input: string, options?: PsdtJsonOptions | string): ConvertResult;
export function jsonToPsd(input: string, options?: JsonToPsdOptions | string): ConvertResult;
export function convert(input: string, options?: ConvertOptions): ConvertResult;
/**
 * 更新图层层级结构
 * @param containerJsonPath 容器JSON文件路径
 * @param layersJsonPath 图层JSON文件路径  
 * @param spec 图层规范对象
 * @returns 更新结果
 */
export function updateLayersWithSpec(containerJsonPath: string, layersJsonPath: string, spec: LayerSpecNode): UpdateLayersResult;

export const Util: {
	initializeAgPsdCanvas: typeof initializeAgPsdCanvas;
	ensureDir: typeof ensureDir;
	externalizePsd: typeof externalizePsd;
	hydratePsd: typeof hydratePsd;
	computeSha256Hex: typeof computeSha256Hex;
	toBase64: typeof toBase64;
	fromBase64ToBuffer: typeof fromBase64ToBuffer;
	stableStringify: typeof stableStringify;
	psdToJson: typeof psdToJson;
	jsonToPsd: typeof jsonToPsd;
	convert: typeof convert;
	updateLayersWithSpec: typeof updateLayersWithSpec;
	getDefaults: () => { outputDir: string; assetsDirName: string };
	configure: (partial: Partial<{ outputDir: string; assetsDirName: string }>) => void;
	loadConfig: (filePath: string) => boolean;
	loadConfigAuto: () => boolean;
};

export default Util;

