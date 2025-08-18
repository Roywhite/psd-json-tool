'use strict';

// 固定示例：直接运行进行往返转换测试
// 运行：node example.js

import { convert, updateLayersWithSpec } from './util.js';

async function main() {
  const inPsd = 'Abyss_1.psd';
  const outJson = 'result/test.json';
  const outPsd = 'result/test.psd';

  console.log('开始：PSD -> JSON');
  const r1 = convert(inPsd, { output: outJson, assetsDirName: 'images' });
  console.log('JSON 输出:', r1.absOut);

  // 可选：只更新某个已存在节点的子树（其他图层保持不变）
  // 注意：第一层节点必须有 id，且该 id 必须存在于容器中
//   const subtreeSpec = {
//     id: 13397, // 已存在的分组/图层 id（必须提供）
//     name: '子树-新名称',
//     children: [
//       { id: 13569 },        // 复用现有节点
//       { 
//         name: '子树-新增图层',  // 新增：无需 id，自动分配不重复 id
//         type: "pixel",
//         image: "images/3219f4abad98a9edf778f331d8b5a70195b9631b0487bdb95fb424744c3f95a9.png"
//       }
//     ]
//   };
//   updateLayersWithSpec('result/test.json', 'result/test.layers.json', subtreeSpec);

//   console.log('开始：JSON -> PSD');
//   const r2 = convert(outJson, { output: outPsd });
//   console.log('PSD 输出:', r2.absOut);
}

main();


