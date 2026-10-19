# Customise Tampermonkey Scripts

个人自定义油猴脚本集合，包含一些定制化的浏览器自动化和广告拦截工具。

## 📦 脚本列表

### 1. Bilibili SponsorBlock Mobile
- **文件名**: `bilibili_sponsor_block_mobile.user.js`
- **功能**: B站移动端自动跳过赞助广告、片头、片尾，支持多P分集，自动清理App诱导横幅

### 2. HLS SSAI Ad Cleaner
- **文件名**: `hls_ssai_ad_cleaner.user.js`
- **功能**: 针对HLS (m3u8)视频流的SSAI广告拦截工具，使用递归Blob代理技术和动态帧率指纹算法过滤隐藏广告

### 3. Lutiandy Ad Cleaner
- **文件名**: `lutiandy_ad_cleaner.user.css`
- **功能**: 深度清除露天电影网(lutiandy.com)页面的顽固悬浮广告和底部悬浮框等恶意占位元素

### 4. Mobile Video Gamepad
- **文件名**: `mobile_video_gamepad.user.js`
- **功能**: 移动端视频网站虚拟控制手柄，全指令化统一UI，支持iframe跨域桥接与全屏自适应

## 🚀 使用方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 浏览器扩展
2. 点击对应的 `.user.js` 文件
3. 点击"安装"按钮即可

## 📝 说明

这些脚本均为个人定制化开发，用于提升浏览体验。如有问题或建议，欢迎提交 Issue。

## 📄 许可证

本仓库全部脚本采用 **GNU Affero General Public License v3.0（AGPLv3）** 开源。

简单说明：
1. 你可以自由使用、修改、分发本仓库代码。
2. 如果**修改本项目后，部署在公网对外提供服务**，你必须向使用者公开修改后的完整源码。
3. 通过API调用本仓库脚本逻辑的独立程序，不受本协议约束，可保持闭源。

[![AGPLv3](https://img.shields.io/badge/license-AGPLv3-blue.svg)](LICENSE)

详见 [LICENSE](./LICENSE) 文件。

## 免责声明

* 本项目仅供学习交流使用，不得用于商业用途，如有侵权请联系删除
* 用户使用本项目所产生的任何后果，需自行承担风险
* 开发者不对使用本项目产生的任何直接或间接损失负责