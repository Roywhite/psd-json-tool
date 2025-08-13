# psd-json-tool

将 PSD 与 JSON 互转的极简工具（ESM）。

- PSD → JSON：图片与二进制资源外置为 PNG，JSON 中记录元信息
- JSON → PSD：根据 JSON 与资源 PNG 还原
- 单方法入口：`convert(input, options)` 自动识别输入类型

## 安装

```bash
npm i psd-json-tool
```

注意：在 Node.js 中需要 Canvas 绑定，推荐安装以下其一（本包会优先尝试 `@napi-rs/canvas`，失败回退到 `canvas`）：
- @napi-rs/canvas（优先，预编译，跨平台更友好）
- canvas（备用，可能需要本地编译环境）

## 快速开始

```js
import Util, { convert, psdToJson, jsonToPsd } from 'psd-json-tool';

// 1) PSD -> JSON（默认写到 result/）
convert('A.psd');

// 2) JSON -> PSD（默认写到 result/）
convert('result/A.json');

// 3) 自定义输出与资源目录
convert('A.psd', { outputDir: 'out', assetsDirName: 'imgs' });
convert('out/A.json', { output: 'build/A.psd' });
```

也可直接运行仓库中的示例：
```bash
node example.js
```

## 路径与目录规则
- 支持绝对路径与相对路径
  - 相对路径按当前工作目录（process.cwd()）解析
- 输出文件 `output`
  - 若提供，为绝对优先；可为绝对或相对（相对 cwd）
- 输出目录 `outputDir`
  - 仅在未提供 `output` 时生效；可为绝对或相对（相对 cwd）
- 资源目录 `assetsDir`
  - PSD→JSON：
    - 若提供绝对路径，直接使用
    - 若提供相对路径，按“输出 JSON 所在目录”解析
    - 未提供则使用 `outputDir/assetsDirName`
  - JSON→PSD：
    - 优先使用 `options.assetsDir`（绝对或相对“输入 JSON 所在目录”）
    - 否则使用 `JSON.__meta.assetsDir`（相对于 JSON 文件）
    - 再否则使用默认 `assetsDirName`（与 JSON 同级目录）
- JSON 内的 `__meta.assetsDir` 始终写为“相对 JSON 文件”的相对路径（Windows 写入时会统一为正斜杠），便于整体移动

## API

### convert(input, options?)
- 自动识别输入类型：`.psd` → PSD→JSON，`.json` → JSON→PSD
- 参数：
  - input: string
  - options?: {
    - output?: string
    - outputDir?: string
    - assetsDirName?: string
    - assetsDir?: string // 指定资源目录（PSD→JSON 相对输出 JSON，JSON→PSD 相对输入 JSON）
  }
- 返回：`{ absOut: string }`

### psdToJson(input, options?)
- 将 PSD 转为 JSON 容器并写出图片资源
- 参数：`{ output?: string; outputDir?: string; assetsDirName?: string; assetsDir?: string }`
- 返回：`{ absOut: string }`

### jsonToPsd(input, options?)
- 将 JSON 容器还原为 PSD
- 参数：`{ output?: string; outputDir?: string; assetsDir?: string }`
- 返回：`{ absOut: string }`

### 工具方法（具名导出 & `Util` 中均可用）
- `initializeAgPsdCanvas()`
- `ensureDir(dir)`
- `externalizePsd(psd, assetsDir)` / `hydratePsd(json, assetsDir)`
- `computeSha256Hex(input)` / `stableStringify(obj)`
- `toBase64(bufLike)` / `fromBase64ToBuffer(b64)`

## 全局默认配置（可选）
无需在每次调用传相同参数，可在包级别统一配置：

```js
import { configure, getDefaults, loadConfigAuto } from 'psd-json-tool';

configure({ outputDir: 'out', assetsDirName: 'imgs' });
console.log(getDefaults());

// 或自动从当前目录读取 psdjson.config.json（若存在）
loadConfigAuto();
```

`psdjson.config.json` 样例：
```json
{
  "outputDir": "out",
  "assetsDirName": "imgs"
}
```

## 依赖
- ag-psd：解析/写出 PSD
- pngjs：读写 PNG
- @napi-rs/canvas 或 canvas：为 ag-psd 提供 Canvas 能力

## 许可
MIT