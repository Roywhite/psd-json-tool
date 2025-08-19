# psd-json-tool

将 PSD 与 JSON 互转的极简工具。

## 功能

- **PSD → JSON**：转换 PSD 文件为 JSON，图片自动提取
- **JSON → PSD**：从 JSON 还原 PSD 文件
- **图层信息**：自动生成简化的图层信息文件
- **层级重构**：支持修改图层结构，新增、删除、重命名图层

## 安装

```bash
npm i psd-json-tool
```

## 快速开始

```js
import { convert } from 'psd-json-tool';

// PSD 转 JSON
convert('input.psd');

// JSON 转 PSD
convert('input.json');
```

## 主要用法

### 基本转换

```js
// 自定义输出路径
convert('input.psd', { output: 'output.json' });

// 自定义资源目录名称（相对于 JSON 所在目录，默认 'images'）
convert('input.psd', { assetsDirName: 'images' });

// 自定义资源目录路径（相对路径以 JSON 所在目录为基准）
convert('input.psd', { output: 'out/foo.json', assetsDir: '../assets' });
```

**参数说明：**
- `input`: 输入文件路径（PSD 或 JSON）
- `options`: 可选配置
  - `output`: 输出文件路径
  - `outputDir`: 输出目录（仅在未提供 `output` 时生效，默认 `'result'`）
  - `assetsDirName`: 资源目录名称（默认 `'images'`，位于 JSON 同级目录）
  - `assetsDir`: 资源目录路径。若为相对路径，则基于 JSON 文件所在目录解析；若为绝对路径则直接使用

> 资源目录优先级：`assetsDir` 高于 `assetsDirName`（若指定 `assetsDir`，将忽略 `assetsDirName`）。

**返回值：**
- `{ absOut: string }` - 输出文件的绝对路径

### 图层层级重构

```js
import { updateLayersWithSpec } from 'psd-json-tool';

const spec = {
  id: 13397,              // 要修改的图层 ID
  name: '新名称',          // 重命名
  children: [
    { id: 13569 },        // 保留现有节点
    { 
      name: '新增图层',    // 新增节点
      type: 'pixel',      // 类型
      image: 'images/new.png'  // 图片路径
    }
  ]
};

updateLayersWithSpec('test.json', 'test.layers.json', spec);
```

**参数说明：**
- `containerJsonPath`: 容器 JSON 文件路径
- `layersJsonPath`: 图层 JSON 文件路径
- `spec`: 图层规范对象
  - `id`: 图层 ID（第一层必须提供）
  - `name`: 图层名称（可选）
  - `type`: 图层类型（可选）
  - `image`: 图片路径（可选）
  - `children`: 子图层数组（可选）

**返回值：**
- `{ absOut: string, newLayersAbsOut: string }` - 更新后的文件路径

## 重要说明

- **第一层必须有 ID**：`spec.id` 必须指向已存在的图层
- **children 完全替换**：指定图层的子节点会被完全替换
- **新增节点自动分配 ID**：不传 ID 的节点会自动分配
- **保留所有字段**：`name`、`type`、`image` 等字段都会被保留

## 输出文件

- `*.json`：完整的 PSD 数据结构
- `*.layers.json`：简化的图层信息
- `images/`：提取的图片资源（默认与 JSON 同级；可通过 `assetsDirName` 或 `assetsDir` 定制）

## 目录行为

- 未显式指定 `output` 时，输出 JSON/PSD 默认写入 `result/` 目录，且会在写入前按需创建父级目录。
- 显式指定 `output` 时，仅创建该输出文件的父级目录；不会无条件创建 `result/`。
- 资源目录默认设置为与 JSON 同级的 `assetsDirName`（默认 `'images'`），亦会按需创建。
- 若同时提供 `assetsDir` 与 `assetsDirName`，以 `assetsDir` 为准。

## 许可

MIT
