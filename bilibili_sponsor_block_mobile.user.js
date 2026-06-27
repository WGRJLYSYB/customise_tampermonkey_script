// ==UserScript==
// @name         Bilibili SponsorBlock Mobile (Lite)
// @name:zh-CN   B站自动跳过推广 (移动端精简版)
// @namespace    bilibili-sponsor-block-mobile
// @version      1.4
// @description  基于 BSBSB 数据，自动跳过B站视频中的赞助广告、片头、片尾。适配多P分集，自动清理App诱导横幅。
// @author       Gavin Newsom
// @match        *://*.bilibili.com/video/*
// @match        *://m.bilibili.com/video/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      bsbsb.top
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const API_BASE = "https://bsbsb.top/api/skipSegments";
    const EXT_VERSION = "0.12.1";
    const LOG_TAG = "[BSB-Mobile]";

    async function sha256(message) {
        const msgUint8 = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    let currentBvid = null;
    let currentP = null;
    let segments = [];
    let video = null;
    let lastSkippedUUID = null;
    let rafId = null;

    // --- 样式：极简提示框 + 移动端牛皮癣清理 ---
    GM_addStyle(`
        .bsb-toast {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-50px);
            background: rgba(20, 20, 20, 0.85); color: #00d2ff; padding: 8px 20px;
            border-radius: 20px; font-size: 13px; z-index: 2147483647;
            backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); pointer-events: none;
            transition: all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); opacity: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .bsb-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

        /* 移除 B 站 App 诱导下载横幅和按钮 */
        .m-video-sheet, .open-app-guide, .m-float-openapp, .v-dialog.open-app-dialog, 
        .m-video-main .m-nav-openapp, .msg-pop-up.open-app, .launch-app-btn, .m-footer-openapp { 
            display: none !important; 
        }
    `);

    function showToast(msg) {
        let toast = document.getElementById('bsb-mobile-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'bsb-mobile-toast';
            toast.className = 'bsb-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function getBvid() {
        const match = window.location.href.match(/\/(BV[a-zA-Z0-9]+)/i);
        return match ? match[1] : null;
    }

    function getPartIndex() {
        const url = new URL(window.location.href);
        return url.searchParams.get('p') || '1';
    }

    async function fetchSegments(bvid, p) {
        try {
            const hash = await sha256(bvid);
            const prefix = hash.substring(0, 4);
            console.log(LOG_TAG, `计算哈希前缀: ${prefix} (${bvid})`);

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `${API_BASE}/${prefix}`,
                    headers: {
                        "X-EXT-VERSION": EXT_VERSION,
                        "Origin": "chrome-extension://eaoelafamejbnggahofapllmfhlhajdd",
                        "Referer": "https://www.bilibili.com/"
                    },
                    onload: (res) => {
                        try {
                            if (res.status !== 200) {
                                if (res.status !== 404) console.warn(LOG_TAG, `API 请求失败: ${res.status}`);
                                resolve([]);
                                return;
                            }
                            const data = JSON.parse(res.responseText);
                            if (Array.isArray(data)) {
                                // 找到匹配当前 bvid 的项
                                const videoData = data.find(item => item.videoID === bvid);
                                if (videoData && Array.isArray(videoData.segments)) {
                                    // 适配 BSB 的数据结构: segment: [start, end]
                                    const mapped = videoData.segments.map(seg => ({
                                        start: seg.segment[0],
                                        end: seg.segment[1],
                                        type: seg.category,
                                        id: seg.UUID
                                    }));
                                    resolve(mapped);
                                } else {
                                    resolve([]);
                                }
                            } else {
                                resolve([]);
                            }
                        } catch (e) {
                            console.error(LOG_TAG, "数据解析异常:", e);
                            resolve([]);
                        }
                    },
                    onerror: (err) => {
                        console.error(LOG_TAG, "网络请求错误:", err);
                        resolve([]);
                    }
                });
            });
        } catch (e) {
            console.error(LOG_TAG, "SHA256 计算失败:", e);
            return [];
        }
    }

    function startSkipEngine() {
        if (rafId) cancelAnimationFrame(rafId);

        const check = () => {
            if (!video || video.paused || segments.length === 0) {
                rafId = requestAnimationFrame(check);
                return;
            }

            const curr = video.currentTime;
            let inAnySegment = false;

            for (const seg of segments) {
                if (curr >= seg.start && curr < seg.end - 0.1) {
                    inAnySegment = true;
                    const uuid = seg.id || (seg.start + "-" + seg.end);
                    if (lastSkippedUUID !== uuid) {
                        lastSkippedUUID = uuid;
                        video.currentTime = seg.end;
                        const typeMap = { 'sponsor': '推广', 'intro': '片头', 'outro': '片尾', 'chat': '闲聊', 'black': '黑屏', 'interaction': '互动提示' };
                        showToast(`🚀 已为您跳过 ${typeMap[seg.type] || '内容'} 片段`);
                        console.log(LOG_TAG, `Skipped ${seg.type}: ${seg.start} -> ${seg.end}`);
                    }
                    break;
                }
            }

            // 核心改进：如果我们当前不在任何需要跳过的段落，解锁 UUID
            // 这样如果用户拉回进度条重新进入广告区，脚本会再次执行跳过
            if (!inAnySegment) {
                lastSkippedUUID = null;
            }

            rafId = requestAnimationFrame(check);
        };
        rafId = requestAnimationFrame(check);
    }

    function init() {
        const newBvid = getBvid();
        const newP = getPartIndex();

        // 只有当 BVID 或 P 变化时才重新请求
        if (!newBvid || (newBvid === currentBvid && newP === currentP)) return;

        currentBvid = newBvid;
        currentP = newP;
        segments = [];
        lastSkippedUUID = null;

        console.log(LOG_TAG, `检测到视频变化: ${newBvid} (P${newP})，获取数据中...`);
        fetchSegments(newBvid, newP).then(data => {
            segments = data;
            if (segments.length > 0) {
                console.log(LOG_TAG, `成功加载 P${newP} 的 ${segments.length} 个标记片段`);
            }
        });
    }

    const findVideo = () => {
        video = document.querySelector('video');
        if (video) {
            init();
            startSkipEngine();
        } else {
            setTimeout(findVideo, 1000);
        }
    };

    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            init();
            // 重新嗅探视频（B站分集切换有时会复用 video 标签，有时会重造）
            const v = document.querySelector('video');
            if (v) video = v;
        }
    }, 1000);

    findVideo();
})();
