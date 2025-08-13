'use strict';

// 固定示例：直接运行进行往返转换测试
// 运行：node example.js

import { convert } from './util.js';

async function main() {
  const inPsd = 'test.psd';
  const outJson = 'result/test.json';
  const outPsd = 'result/test.psd';

  console.log('开始：PSD -> JSON');
  const r1 = convert(inPsd, { output: outJson, assetsDirName: 'images' });
  console.log('JSON 输出:', r1.absOut);

  console.log('开始：JSON -> PSD');
  const r2 = convert(outJson, { output: outPsd });
  console.log('PSD 输出:', r2.absOut);
}

main();


