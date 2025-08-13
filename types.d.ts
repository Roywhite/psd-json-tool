// TypeScript 声明文件（ESM）
// 为 js 用户提供智能提示；实际实现位于 ESM 源码中

export interface ConvertOptions {
	output?: string;
	outputDir?: string;
	assetsDirName?: string;
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

export function initializeAgPsdCanvas(): void;
export function ensureDir(dir: string): void;
export function computeSha256Hex(bufferLike: Buffer | ArrayBuffer | ArrayBufferView | string): string;
export function toBase64(input: Buffer | ArrayBuffer | ArrayBufferView): string;
export function fromBase64ToBuffer(base64: string): Buffer;
export function stableStringify(value: unknown): string;

export function psdToJson(input: string, options?: PsdtJsonOptions | string): ConvertResult;
export function jsonToPsd(input: string, options?: JsonToPsdOptions | string): ConvertResult;
export function convert(input: string, options?: ConvertOptions): ConvertResult;

export const Util: {
	initializeAgPsdCanvas: typeof initializeAgPsdCanvas;
	ensureDir: typeof ensureDir;
	computeSha256Hex: typeof computeSha256Hex;
	toBase64: typeof toBase64;
	fromBase64ToBuffer: typeof fromBase64ToBuffer;
	stableStringify: typeof stableStringify;
	psdToJson: typeof psdToJson;
	jsonToPsd: typeof jsonToPsd;
	convert: typeof convert;
	getDefaults: () => { outputDir: string; assetsDirName: string };
	configure: (partial: Partial<{ outputDir: string; assetsDirName: string }>) => void;
	loadConfig: (filePath: string) => boolean;
	loadConfigAuto: () => boolean;
};

export default Util;

