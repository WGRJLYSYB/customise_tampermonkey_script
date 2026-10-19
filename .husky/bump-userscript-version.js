const { execSync } = require('child_process');
const fs = require('fs');

// ===================== 配置区 =====================
// 匹配所有 .user.js 文件，你可以改成子目录如 "src/*.user.js"
const GLOB_PATTERN = "*.user.js";
// =================================================

function runCmd(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// 获取本次staged的文件列表
const stagedFiles = runCmd('git diff --cached --name-only')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

// 筛选出所有 .user.js
const userScriptFiles = stagedFiles.filter(f => f.endsWith('.user.js'));
if (userScriptFiles.length === 0) {
  console.log("ℹ️ 本次提交没有油猴脚本，跳过版本处理");
  process.exit(0);
}

for (const filePath of userScriptFiles) {
  console.log(`\n===== 处理脚本：${filePath} =====`);

  let oldContent;
  try {
    // 上一次提交(HEAD)的文件内容
    oldContent = runCmd(`git show HEAD:${filePath}`);
  } catch (e) {
    console.log(`ℹ️ ${filePath}：首次提交，无历史版本，跳过`);
    continue;
  }

  // 暂存区当前文件内容
  const stagedContent = runCmd(`git show :${filePath}`);

  // 正则：捕获【行首空白】 + // @version +【version后的空白】 + 版本号
  const verReg = /^(\s*)(\/\/ @version)(\s+)(\d+\.\d+\.\d+)/m;
  const oldMatch = oldContent.match(verReg);
  const stagedMatch = stagedContent.match(verReg);

  if (!oldMatch || !stagedMatch) {
    console.log(`⚠️ ${filePath}：找不到合法 // @version x.y.z，跳过`);
    continue;
  }

  const oldVer = oldMatch[4];
  const stagedVer = stagedMatch[4];

  // 【核心规则】如果暂存版本 != 旧版本 → 你手动修改版本号，不自动升级
  if (stagedVer !== oldVer) {
    console.log(`✅ ${filePath}：手动更新版本 ${oldVer} → ${stagedVer}，不自动自增`);
    continue;
  }

  // 对比diff，过滤所有 // @ 开头的差异行，判断业务代码是否改动
  const rawDiff = runCmd(`git diff --cached ${filePath}`);
  const codeDiffLines = rawDiff
    .split('\n')
    .filter(line => !line.match(/^[+-]\s*\/\/ @/));

  const hasCodeChange = codeDiffLines.some(line => line.trim() !== "");
  if (!hasCodeChange) {
    console.log(`ℹ️ ${filePath}：仅修改元注释，业务代码无改动，无需升级`);
    continue;
  }

  // 走到这里：版本号没变 + 业务代码改动 → patch +1
  console.log(`🔍 ${filePath}：业务代码修改，但版本未更新 ${oldVer}`);
  const [ma, mi, pa] = oldVer.split('.').map(Number);
  const newVer = `${ma}.${mi}.${pa + 1}`;
  console.log(`✅ 自动升级版本：${oldVer} → ${newVer}`);

  // $1 行首缩进，$2 // @version，$3 version后面原有的多个空格
  const newFileContent = stagedContent.replace(verReg, `$1$2$3${newVer}`);
  fs.writeFileSync(filePath, newFileContent, 'utf8');

  // 将修改后的文件加入暂存区，纳入本次commit
  runCmd(`git add ${filePath}`);
}

console.log("\n🎉 版本处理完成");
process.exit(0);
