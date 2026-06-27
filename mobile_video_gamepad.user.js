// ==UserScript==
// @name         Mobile Video Gamepad (Glass Edition)
// @name:zh-CN   移动端视频“游戏手柄”控制器 (极简玻璃质感)
// @namespace    mobile-video-gamepad
// @version      11.8
// @description      针对移动端视频网站优化的虚拟控制手柄。里程碑版本：全指令化统一 UI（图标指示未来动作，圆环指示当前状态）。支持 iframe 跨域桥接与全屏自适应。
// @author       Gavin Newsom
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';
    const LOG_TAG = '[VideoGamepad]';
    const isTop = (window.self === window.top);

    // --- 针对 YouTube 的 Trusted Types 策略修复 ---
    let ttPolicy;
    try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            ttPolicy = window.trustedTypes.createPolicy('vg-policy', {
                createHTML: (string) => string
            });
        }
    } catch (e) { }

    function toTrustedHTML(htmlString) {
        return ttPolicy ? ttPolicy.createHTML(htmlString) : htmlString;
    }

    // --- 样式定义 ---
    const css = `
        #vg-gamepad-hud {
            --vg-btn-size: 50px;
            --vg-dpad-size: 48px;
            --vg-panel-bottom: 30px;
            --vg-panel-height: 150px;
            --vg-font-size: 18px;
            --vg-vol-size: 26px;
            --vg-gap: 12px;
            --vg-knob-size: 130px;

            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
            transition: opacity 0.5s ease;
            opacity: 0;
            touch-action: none;
        }
        #vg-gamepad-hud.vg-visible { opacity: 1; }
        #vg-gamepad-hud.vg-visible.vg-fullscreen { pointer-events: auto; }
        #vg-gamepad-hud.vg-idle { opacity: 0.45; }

        @media (orientation: portrait) {
            #vg-gamepad-hud {
                --vg-btn-size: 75px;
                --vg-dpad-size: 70px;
                --vg-panel-bottom: 80px;
                --vg-panel-height: 230px;
                --vg-font-size: 26px;
                --vg-vol-size: 46px;
                --vg-gap: 15px;
                --vg-knob-size: 180px;
            }
        }

        .vg-panel {
            position: absolute; bottom: var(--vg-panel-bottom); height: var(--vg-panel-height);
            pointer-events: auto; display: flex; touch-action: none;
        }
        #vg-left-panel {
            left: 30px; width: calc(var(--vg-dpad-size) * 3 + 20px); display: grid;
            grid-template-areas: ". up ." "left reset right" ". down .";
            grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr;
            gap: 5px; align-content: center;
        }
        #vg-right-panel {
            right: 30px; width: calc(var(--vg-btn-size) * 2 + var(--vg-gap) + 10px); 
            display: flex; flex-wrap: wrap;
            justify-content: flex-end; align-content: center; gap: var(--vg-gap);
        }
        .vg-btn {
            background: rgba(45, 45, 45, 0.9); border: 1px solid rgba(255, 255, 255, 0.15);
            color: #efefef; display: flex; align-items: center; justify-content: center;
            font-size: var(--vg-font-size); box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            transition: all 0.1s; cursor: pointer; touch-action: none;
            position: relative; overflow: hidden;
        }
        .vg-btn:active {
            transform: scale(0.92); background: rgba(80, 80, 80, 1);
            box-shadow: inset 0 0 10px rgba(0,0,0,0.5); border-color: rgba(255,255,255,0.3);
        }
        .vg-btn.active { border-color: rgba(255, 255, 255, 0.4); }
        
        .vg-progress-svg {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            transform: rotate(-90deg); pointer-events: none; z-index: 1;
        }
        .vg-progress-bg { fill: none; stroke: rgba(255, 255, 255, 0.08); stroke-width: 6; }
        .vg-progress-bar {
            fill: none; stroke: #00d2ff; stroke-width: 6;
            stroke-dasharray: 283; 
            stroke-dashoffset: calc(283 - (283 * var(--vg-progress, 0)) / 100);
            stroke-linecap: round; 
            transition: stroke-dashoffset 0.15s linear !important;
        }
        
        /* 炫彩配色系统 */
        .btn-play .vg-progress-bar { stroke: #00d2ff; } 
        .btn-mute .vg-progress-bar { 
            stroke: #f39c12; 
            stroke-dashoffset: calc(283 - (283 * var(--vg-vol-progress, 0)) / 100);
        }
        .btn-speed .vg-progress-bar { stroke: #2ecc71; } 
        .btn-fs .vg-progress-bar { stroke: #9b59b6; }

        .vg-action-btn span { position: relative; z-index: 2; font-size: 0.95em; }

        .vg-dpad-btn { border-radius: 12px; width: var(--vg-dpad-size); height: var(--vg-dpad-size); }
        .btn-up { grid-area: up; font-weight: 900; color: #fff !important; font-size: var(--vg-vol-size) !important; line-height: 1; } 
        .btn-down { grid-area: down; font-weight: 900; color: #fff !important; font-size: var(--vg-vol-size) !important; line-height: 1; }
        .btn-left { grid-area: left; }
        .btn-right { grid-area: right; }
        .btn-reset { grid-area: reset; border-radius: 50%; background: rgba(60, 60, 60, 0.9); font-weight: bold; }
        .vg-action-btn { width: var(--vg-btn-size); height: var(--vg-btn-size); border-radius: 50%; }
        .vg-toast {
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85); color: white; padding: 10px 25px; border-radius: 25px;
            font-size: 14px; z-index: 2147483648; opacity: 0; transition: opacity 0.3s; pointer-events: none;
            display: flex; align-items: center; justify-content: center;
        }
        
        /* 强制隐藏原生控制条 */
        video::-webkit-media-controls { display: none !important; }
        video::-webkit-media-controls-enclosure { display: none !important; }
        video::-webkit-media-controls-panel { display: none !important; }

        /* --- 大旋钮样式 --- */
        #vg-knob-container {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.6);
            width: var(--vg-knob-size); height: var(--vg-knob-size); border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(70,70,70,0.92) 0%, rgba(20,20,20,0.98) 100%);
            border: 2px solid rgba(255,255,255,0.15);
            box-shadow: 0 10px 40px rgba(0,0,0,0.7), inset 0 0 20px rgba(255,255,255,0.05);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 100;
        }
        .knob-active #vg-knob-container { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        .knob-active .vg-action-btn { opacity: 0 !important; transform: scale(0.5); pointer-events: none; }
        
        #vg-knob-value { font-size: calc(var(--vg-knob-size) * 0.22); font-weight: bold; color: #fff; margin-bottom: 2px; }
        #vg-knob-label { font-size: calc(var(--vg-knob-size) * 0.08); color: rgba(255,255,255,0.6); letter-spacing: 1px; }
        
        .vg-knob-ring {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            transform: rotate(-90deg); pointer-events: none; padding: 4px; box-sizing: border-box;
        }
        .vg-knob-ring circle { fill: none; stroke: #00d2ff; stroke-width: 4; stroke-dasharray: 283; stroke-linecap: round; transition: stroke-dashoffset 0.1s; }
        
        #vg-knob-indicator-wrap {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;
        }
        #vg-knob-indicator-dot {
            position: absolute; top: 14%; left: 50%; transform: translateX(-50%);
            width: 7px; height: 7px; background: #ff3b30; border-radius: 50%;
            box-shadow: 0 0 10px #ff3b30, 0 0 20px rgba(255,59,48,0.5);
        }
    `;

    // --- 声音合成器 ---
    let audioCtx = null;
    function playBeep(freq, duration, vol) {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(vol, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) { }
    }

    // --- 核心状态 ---
    let isSpeedShift = false;
    let vgToastTimer = null;
    let wasPlayingBeforeSeek = false;
    let isCurrentlySeeking = false;

    let turboTimer = null;
    let repeatTimer = null;
    let knobTimer = null;
    const REPEATABLE_ACTIONS = ['volUp', 'volDown', 'prev', 'next'];

    // 旋钮状态
    let knobActive = false;
    let knobWasActive = false;
    let knobType = '';
    let lastAngle = 0;
    let knobInternalAngle = 0;
    let knobBaseValue = 0;
    let knobVirtualTime = 0;
    let knobStepCount = 0;
    let idleTimer = null;
    let lastPersistenceKey = '';
    let lastSaveTime = 0;

    // --- 跨域/跨 iframe 桥接状态 ---
    let remoteVideoState = null;
    let remoteSource = null;
    let remoteOrigin = null;
    let lastRemoteTime = 0;

    // --- 工具：简单哈希函数 ---
    function getHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16);
    }

    function getStorageKey() {
        const pathPart = location.pathname + location.search;
        return `vg_v2_${location.host}_${getHash(pathPart)}`;
    }

    // --- 持久化存储 ---
    function saveState() {
        const video = getActiveVideo();
        if (!video || isNaN(video.duration) || video.duration < 10) return;
        const key = getStorageKey();
        const state = {
            time: video.currentTime,
            vol: video.volume,
            ts: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(state));
        lastSaveTime = Date.now();
    }

    function restoreState(video) {
        // 核心修改：等待元数据 duration 加载完成后才还原进度
        if (isNaN(video.duration) || video.duration <= 0) return;
        const key = getStorageKey();
        if (key === lastPersistenceKey) return;
        const raw = localStorage.getItem(key);
        if (!raw) {
            lastPersistenceKey = key;
            return;
        }
        try {
            const state = JSON.parse(raw);
            if (Date.now() - state.ts < 604800000 && state.time < video.duration - 5) {
                video.currentTime = state.time;
                video.volume = state.vol;
                showToast(`已恢复 1 周内进度: ${formatTime(state.time)}`);
            }
            lastPersistenceKey = key;
        } catch (e) { }
    }

    function restoreVolume(video) {
        if (video.dataset.vgVolRestored) return;
        const key = getStorageKey();
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                const state = JSON.parse(raw);
                if (state && typeof state.vol === 'number') {
                    video.volume = state.vol;
                }
            } catch (e) { }
        }
        video.dataset.vgVolRestored = "true";
    }

    function resetIdleTimer() {
        const hud = document.getElementById('vg-gamepad-hud');
        if (hud) {
            hud.classList.remove('vg-idle');
            hud.classList.add('vg-visible');
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (!knobActive && !turboTimer && !repeatTimer) {
                const hud = document.getElementById('vg-gamepad-hud');
                if (hud) hud.classList.add('vg-idle');
            }
        }, 5000);
    }

    // --- 抽象控制机制 ---
    function hasActiveVideo() {
        if (getActiveVideo()) return true;
        if (remoteVideoState && (Date.now() - lastRemoteTime < 2000)) return true;
        return false;
    }

    function sendCommand(action, value = null) {
        if (remoteSource) {
            remoteSource.postMessage({
                type: 'vg-command',
                action: action,
                value: value,
                isSpeedShift: isSpeedShift,
                wasPlayingBeforeSeek: wasPlayingBeforeSeek
            }, remoteOrigin);
        }
    }

    function getActiveVideoVolume() {
        const v = getActiveVideo();
        if (v) return v.volume;
        if (remoteVideoState) return remoteVideoState.volume;
        return 1.0;
    }

    function setActiveVideoVolume(val) {
        const v = getActiveVideo();
        if (v) {
            v.volume = val;
        } else {
            if (remoteVideoState) remoteVideoState.volume = val;
            sendCommand('setVolume', val);
        }
    }

    function getActiveVideoPlaybackRate() {
        const v = getActiveVideo();
        if (v) return v.playbackRate;
        if (remoteVideoState) return remoteVideoState.playbackRate;
        return 1.0;
    }

    function setActiveVideoPlaybackRate(val) {
        const v = getActiveVideo();
        if (v) {
            v.playbackRate = val;
        } else {
            if (remoteVideoState) remoteVideoState.playbackRate = val;
            sendCommand('setPlaybackRate', val);
        }
    }

    function getActiveVideoCurrentTime() {
        const v = getActiveVideo();
        if (v) return v.currentTime;
        if (remoteVideoState) return remoteVideoState.currentTime;
        return 0;
    }

    function setActiveVideoCurrentTime(val) {
        const v = getActiveVideo();
        if (v) {
            v.currentTime = val;
        } else {
            if (remoteVideoState) remoteVideoState.currentTime = val;
            sendCommand('setCurrentTime', val);
        }
    }

    function getActiveVideoDuration() {
        const v = getActiveVideo();
        if (v) return v.duration;
        if (remoteVideoState) return remoteVideoState.duration;
        return 0;
    }

    function getActiveVideoPaused() {
        const v = getActiveVideo();
        if (v) return v.paused;
        if (remoteVideoState) return remoteVideoState.paused;
        return true;
    }

    function getActiveVideoMuted() {
        const v = getActiveVideo();
        if (v) return v.muted;
        if (remoteVideoState) return remoteVideoState.muted;
        return false;
    }

    function setActiveVideoMuted(val) {
        const v = getActiveVideo();
        if (v) {
            v.muted = val;
        } else {
            if (remoteVideoState) remoteVideoState.muted = val;
            sendCommand('setMuted', val);
        }
    }

    function executeVideoPlay() {
        const v = getActiveVideo();
        if (v) {
            v.play();
        } else {
            if (remoteVideoState) remoteVideoState.paused = false;
            sendCommand('play');
        }
    }

    function executeVideoPause() {
        const v = getActiveVideo();
        if (v) {
            v.pause();
        } else {
            if (remoteVideoState) remoteVideoState.paused = true;
            sendCommand('pause');
        }
    }

    function stopTurbo(reason = 'unknown') {
        const isRepeatMode = !!repeatTimer;
        const isKnobMode = !!knobActive;

        if (turboTimer) clearTimeout(turboTimer);
        if (repeatTimer) clearInterval(repeatTimer);
        if (knobTimer) clearTimeout(knobTimer);
        turboTimer = null;
        repeatTimer = null;
        knobTimer = null;

        if (isKnobMode) {
            console.log(LOG_TAG, '停止旋钮模式, 原因:', reason);
            if (knobType === 'seek') {
                if (getActiveVideo()) {
                    getActiveVideo().currentTime = knobVirtualTime;
                } else {
                    sendCommand('seekEnd', knobVirtualTime);
                }
            }
            knobActive = false;
            knobWasActive = true;
            const panel = document.getElementById('vg-right-panel');
            if (panel) {
                panel.classList.remove('knob-active');
                if (panel.releasePointerCapture && knobPointerId !== null) {
                    try { panel.releasePointerCapture(knobPointerId); } catch (e) { }
                }
            }
            knobPointerId = null;
        }

        if (isCurrentlySeeking) {
            if (knobType === 'seek' || isRepeatMode) {
                if (getActiveVideo()) {
                    getActiveVideo().currentTime = knobVirtualTime;
                } else {
                    sendCommand('seekEnd', knobVirtualTime);
                }
            }

            if (wasPlayingBeforeSeek) {
                if (getActiveVideo()) {
                    getActiveVideo().play();
                }
            }
            isCurrentlySeeking = false;
        }

        knobType = '';
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return (h > 0 ? h + ":" : "") +
            (m < 10 ? "0" + m : m) + ":" +
            (s < 10 ? "0" + s : s);
    }

    function initUI() {
        if (document.getElementById('vg-gamepad-hud')) return;
        GM_addStyle(css);

        const hudHtmlStr = `
            <div id="vg-left-panel" class="vg-panel">
                <div class="vg-btn vg-dpad-btn btn-up" data-action="volUp">+</div>
                <div class="vg-btn vg-dpad-btn btn-down" data-action="volDown">-</div>
                <div class="vg-btn vg-dpad-btn btn-left" data-action="prev">⏪</div>
                <div class="vg-btn vg-dpad-btn btn-right" data-action="next">⏩</div>
                <div class="vg-btn btn-reset" data-action="resetSpeed">1️⃣</div>
            </div>
            <div id="vg-right-panel" class="vg-panel">
                <div class="vg-btn vg-action-btn btn-play" data-action="togglePlay">
                    <svg class="vg-progress-svg" viewBox="0 0 100 100">
                        <circle class="vg-progress-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="vg-progress-bar" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <span>▶️</span>
                </div>
                <div class="vg-btn vg-action-btn btn-mute" data-action="toggleMute">
                    <svg class="vg-progress-svg" viewBox="0 0 100 100">
                        <circle class="vg-progress-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="vg-progress-bar" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <span>🔇</span>
                </div>
                <div class="vg-btn vg-action-btn btn-speed" data-action="toggleSpeedShift">
                    <svg class="vg-progress-svg" viewBox="0 0 100 100">
                        <circle class="vg-progress-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="vg-progress-bar" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <span>⚡</span>
                </div>
                <div class="vg-btn vg-action-btn btn-fs" data-action="toggleFS">
                    <svg class="vg-progress-svg" viewBox="0 0 100 100">
                        <circle class="vg-progress-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="vg-progress-bar" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <span>📺</span>
                </div>
                <!-- 大旋钮容器 -->
                <div id="vg-knob-container">
                    <svg class="vg-knob-ring" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45"></circle>
                    </svg>
                    <div id="vg-knob-indicator-wrap">
                        <div id="vg-knob-indicator-dot"></div>
                    </div>
                    <div id="vg-knob-value">--</div>
                    <div id="vg-knob-label">设置</div>
                </div>
            </div>
            <div id="vg-toast-box" class="vg-toast"></div>
        `;

        const hud = document.createElement('div');
        hud.id = 'vg-gamepad-hud';

        try {
            const range = document.createRange();
            range.selectNode(document.body);
            const fragment = range.createContextualFragment(toTrustedHTML(hudHtmlStr));
            hud.appendChild(fragment);
            document.body.appendChild(hud);
            bindEvents(hud);
            resetIdleTimer();
            console.log(LOG_TAG, 'UI 注入成功');
        } catch (e) {
            console.error(LOG_TAG, 'UI 注入失败:', e);
        }
    }

    function showToast(msg) {
        const toast = document.getElementById('vg-toast-box');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(vgToastTimer);
        vgToastTimer = setTimeout(() => toast.style.opacity = '0', 1500);
    }

    function getActiveVideo() {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;
        let playing = videos.find(v => !v.paused);
        if (playing) return playing;
        if (document.fullscreenElement) {
            const fsVideo = document.fullscreenElement.querySelector('video') || (document.fullscreenElement.tagName === 'VIDEO' ? document.fullscreenElement : null);
            if (fsVideo) return fsVideo;
        }
        return videos.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
    }

    let knobPointerId = null;
    function bindEvents(hud) {
        hud.addEventListener('pointerdown', (e) => {
            resetIdleTimer();
        }, true);

        hud.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.vg-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-action');

            playBeep(800, 0.1, 0.08);
            e.preventDefault(); e.stopPropagation();
            knobWasActive = false;

            if (action === 'toggleMute' || action === 'toggleSpeedShift' || action === 'togglePlay') {
                knobTimer = setTimeout(() => {
                    activateKnob(action, e);
                }, 500);
            }

            if (REPEATABLE_ACTIONS.includes(action)) {
                if (action === 'prev' || action === 'next') {
                    const hasVid = hasActiveVideo();
                    if (hasVid && !isSpeedShift) {
                        isCurrentlySeeking = true;
                        wasPlayingBeforeSeek = !getActiveVideoPaused();
                        knobVirtualTime = getActiveVideoCurrentTime();
                        if (getActiveVideo()) {
                            getActiveVideo().pause();
                        } else {
                            sendCommand('seekStart');
                        }
                    }
                }

                handleAction(action, btn, hud);
                turboTimer = setTimeout(() => {
                    repeatTimer = setInterval(() => {
                        playBeep(800, 0.05, 0.05);
                        handleAction(action, btn, hud);
                    }, 100);
                }, 500);
            }
        }, true);

        hud.addEventListener('pointermove', (e) => {
            if (knobActive) {
                handleKnobMove(e);
                e.preventDefault(); e.stopPropagation();
            }
        }, true);

        hud.addEventListener('pointerup', (e) => {
            const btn = e.target.closest('.vg-btn');
            if (!btn) { stopTurbo('pointerup_no_btn'); return; }
            const action = btn.getAttribute('data-action');

            const wasKnob = knobActive || knobWasActive;
            stopTurbo('pointerup_with_btn');

            if (!REPEATABLE_ACTIONS.includes(action) && !wasKnob) {
                handleAction(action, btn, hud);
            }

            playBeep(600, 0.05, 0.04);
            stopTurbo('pointerup_finish');
            e.preventDefault(); e.stopPropagation();
        }, true);

        hud.addEventListener('pointerleave', () => {
            if (!knobActive) stopTurbo('pointerleave');
        }, true);
        hud.addEventListener('pointercancel', () => stopTurbo('pointercancel'), true);
        const eventsToBlock = ['contextmenu', 'selectstart'];
        eventsToBlock.forEach(evt => {
            hud.addEventListener(evt, (e) => {
                e.preventDefault(); e.stopPropagation();
            }, true);
        });

        document.addEventListener('fullscreenchange', () => {
            const fsElem = document.fullscreenElement || document.webkitFullscreenElement;
            const hud = document.getElementById('vg-gamepad-hud');
            if (hud) (fsElem || document.body).appendChild(hud);
        });

        function isPageFullscreen() {
            return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || document.webkitIsFullScreen);
        }

        let gStartX, gStartY;
        let gCurrentType = '';
        let gBaseValue = 0;

        hud.addEventListener('pointerdown', (e) => {
            if (!isPageFullscreen()) return;
            if (e.target.closest('.vg-panel')) return;

            const hasVid = hasActiveVideo();
            if (hasVid) {
                wasPlayingBeforeSeek = !getActiveVideoPaused();
                knobVirtualTime = getActiveVideoCurrentTime();
                gBaseValue = getActiveVideoCurrentTime();
            }

            gStartX = e.clientX;
            gStartY = e.clientY;
            gCurrentType = '';
            resetIdleTimer();
        });

        hud.addEventListener('pointermove', (e) => {
            if (!gStartX || !isPageFullscreen()) return;
            if (e.target.closest('.vg-panel')) return;

            const dx = e.clientX - gStartX;
            const dy = e.clientY - gStartY;
            const hasVid = hasActiveVideo();
            if (!hasVid) return;

            resetIdleTimer();

            if (!gCurrentType) {
                const absX = Math.abs(dx);
                const absY = Math.abs(dy);
                if (absX > 30 && absX > absY) {
                    gCurrentType = 'seek';
                    isCurrentlySeeking = true;
                    gBaseValue = getActiveVideoCurrentTime();
                    if (getActiveVideo()) {
                        getActiveVideo().pause();
                    } else {
                        sendCommand('seekStart');
                    }
                } else if (absY > 30 && absY > absX && gStartX > window.innerWidth * 0.5) {
                    gCurrentType = 'vol';
                    gBaseValue = getActiveVideoVolume();
                    if (getActiveVideoMuted()) {
                        setActiveVideoMuted(false);
                    }
                }
            }

            if (gCurrentType) {
                if (gCurrentType === 'seek') {
                    const delta = (dx / window.innerWidth) * 120;
                    knobVirtualTime = Math.max(0, Math.min(getActiveVideoDuration(), gBaseValue + delta));
                    updateGestureTip('seek', knobVirtualTime, getActiveVideoDuration());
                } else if (gCurrentType === 'vol') {
                    const delta = -(dy / window.innerHeight) * 1.5;
                    const newVol = Math.max(0, Math.min(1, gBaseValue + delta));
                    setActiveVideoVolume(newVol);
                    updateGestureTip('vol', newVol);
                }
            }
        });

        hud.addEventListener('pointerup', (e) => {
            if (!gStartX) return;
            const dx = e.clientX - gStartX;
            const dy = e.clientY - gStartY;
            const moveDist = Math.sqrt(dx * dx + dy * dy);

            if (gCurrentType === 'seek') {
                if (getActiveVideo()) {
                    getActiveVideo().currentTime = knobVirtualTime;
                    if (wasPlayingBeforeSeek) getActiveVideo().play();
                } else {
                    sendCommand('seekEnd', knobVirtualTime);
                }
                isCurrentlySeeking = false;
            } else if (!gCurrentType && moveDist < 10) {
                getActiveVideoPaused() ? executeVideoPlay() : executeVideoPause();
            }
            gStartX = null; gCurrentType = '';
        });
    }

    function updateGestureTip(type, val, total = 0) {
        if (type === 'seek') {
            showToast(`${formatTime(val)} / ${formatTime(total)}`);
        } else {
            showToast(`音量: ${Math.round(val * 100)}%`);
        }
    }

    function activateKnob(action, e) {
        const hasVid = hasActiveVideo();
        if (!hasVid) return;

        console.log(LOG_TAG, '激活旋钮模式:', action);
        knobActive = true;
        if (action === 'toggleMute') knobType = 'volume';
        else if (action === 'toggleSpeedShift') knobType = 'speed';
        else knobType = 'seek';

        if (knobType === 'seek') {
            isCurrentlySeeking = true;
            wasPlayingBeforeSeek = !getActiveVideoPaused();
            if (getActiveVideo()) {
                getActiveVideo().pause();
            } else {
                sendCommand('seekStart');
            }
        }

        const panel = document.getElementById('vg-right-panel');
        if (!panel) return;
        panel.classList.add('knob-active');

        const rect = panel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        knobInternalAngle = 0;
        lastAngle = 0;
        const indicator = document.getElementById('vg-knob-indicator-wrap');
        if (indicator) indicator.style.transform = 'rotate(0rad)';

        if (knobType === 'seek') {
            knobVirtualTime = getActiveVideoCurrentTime();
            knobBaseValue = knobVirtualTime;
        } else {
            knobBaseValue = (knobType === 'volume') ? getActiveVideoVolume() : getActiveVideoPlaybackRate();
        }

        knobPointerId = e.pointerId;
        if (panel.setPointerCapture) panel.setPointerCapture(e.pointerId);

        updateKnobUI(knobBaseValue);
        playBeep(1200, 0.1, 0.1);
    }

    function handleKnobMove(e) {
        const hasVid = hasActiveVideo();
        if (!hasVid) return;

        const panel = document.getElementById('vg-right-panel');
        const rect = panel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        if (knobActive && lastAngle === 0) lastAngle = currentAngle;

        let delta = currentAngle - lastAngle;

        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;

        lastAngle = currentAngle;
        knobInternalAngle += delta;

        if (knobType === 'volume') {
            const denom = isSpeedShift ? (Math.PI * 2) : (Math.PI * 20.0);
            let targetVol = knobBaseValue + (knobInternalAngle / denom);
            if (targetVol < 0) {
                targetVol = 0;
                knobInternalAngle = (0 - knobBaseValue) * denom;
            } else if (targetVol > 1) {
                targetVol = 1;
                knobInternalAngle = (1 - knobBaseValue) * denom;
            }
            setActiveVideoVolume(targetVol);
            updateKnobUI(targetVol);
        } else if (knobType === 'speed') {
            let targetRate = knobBaseValue + (knobInternalAngle / (Math.PI * 2));
            if (targetRate < 0.25) {
                targetRate = 0.25;
                knobInternalAngle = (0.25 - knobBaseValue) * (Math.PI * 2);
            } else if (targetRate > 4) {
                targetRate = 4;
                knobInternalAngle = (4 - knobBaseValue) * (Math.PI * 2);
            }
            const rateRounded = Math.round(targetRate * 100) / 100;
            setActiveVideoPlaybackRate(rateRounded);
            updateKnobUI(rateRounded);
        } else {
            const duration = getActiveVideoDuration();
            const scale = isSpeedShift ? duration : 60;
            let targetTime = knobBaseValue + (knobInternalAngle / (Math.PI * 2)) * scale;
            if (targetTime < 0) {
                targetTime = 0;
                knobInternalAngle = scale > 0 ? ((0 - knobBaseValue) / scale) * (Math.PI * 2) : 0;
            } else if (targetTime > duration) {
                targetTime = duration;
                knobInternalAngle = scale > 0 ? ((duration - knobBaseValue) / scale) * (Math.PI * 2) : 0;
            }
            knobVirtualTime = targetTime;
            updateKnobUI(knobVirtualTime);
        }

        const indicator = document.getElementById('vg-knob-indicator-wrap');
        if (indicator) indicator.style.transform = `rotate(${knobInternalAngle}rad)`;

        knobStepCount += Math.abs(delta);
        if (knobStepCount > 0.15) {
            playBeep(1000, 0.02, 0.03);
            knobStepCount = 0;
        }
    }

    function updateKnobUI(val) {
        const valEl = document.getElementById('vg-knob-value');
        const labelEl = document.getElementById('vg-knob-label');
        const circle = document.querySelector('.vg-knob-ring circle');

        let displayStr = "";
        if (knobType === 'volume') displayStr = Math.round(val * 100) + '%';
        else if (knobType === 'speed') displayStr = val.toFixed(2) + 'x';
        else displayStr = formatTime(val);

        if (knobType === 'volume') {
            valEl.textContent = displayStr;
            labelEl.textContent = '音量';
            circle.style.strokeDashoffset = 283 - (283 * val);
            circle.style.stroke = '#f39c12';
        } else if (knobType === 'speed') {
            valEl.textContent = displayStr;
            labelEl.textContent = '倍速';
            circle.style.strokeDashoffset = 283 - (283 * (val / 4.0));
            circle.style.stroke = '#2ecc71';
        } else {
            valEl.textContent = displayStr;
            labelEl.textContent = '进度';
            const duration = getActiveVideoDuration();
            if (circle && !isNaN(duration) && duration > 0) {
                const p = (val / duration) * 100;
                circle.style.strokeDashoffset = 283 - (283 * p) / 100;

                const playBtn = document.querySelector('.btn-play');
                if (playBtn && knobType === 'seek') {
                    playBtn.style.setProperty('--vg-progress', p);
                }
            }
            circle.style.stroke = '#00d2ff';
        }
    }

    function handleAction(action, btn, hud) {
        const hasVid = hasActiveVideo();
        if (!hasVid && action !== 'toggleSpeedShift') {
            showToast("未检测到视频");
            return;
        }

        switch (action) {
            case 'volUp': {
                const vol = Math.min(1, getActiveVideoVolume() + 0.05);
                setActiveVideoVolume(vol);
                showToast(`音量: ${Math.round(vol * 100)}%`);
                break;
            }
            case 'volDown': {
                const vol = Math.max(0, getActiveVideoVolume() - 0.05);
                setActiveVideoVolume(vol);
                showToast(`音量: ${Math.round(vol * 100)}%`);
                break;
            }
            case 'prev':
                if (isSpeedShift) {
                    const rate = Math.max(0.25, getActiveVideoPlaybackRate() - 0.25);
                    setActiveVideoPlaybackRate(Math.round(rate * 100) / 100);
                    showToast(`倍速: ${getActiveVideoPlaybackRate().toFixed(2)}x`);
                }
                else {
                    const duration = getActiveVideoDuration();
                    if (repeatTimer) {
                        knobVirtualTime = Math.max(0, knobVirtualTime - 2.5);
                        showToast(`${formatTime(knobVirtualTime)} / ${formatTime(duration)}`);
                        const playBtn = document.querySelector('.btn-play');
                        if (playBtn && duration > 0) {
                            playBtn.style.setProperty('--vg-progress', (knobVirtualTime / duration) * 100);
                        }
                    } else {
                        const cur = Math.max(0, getActiveVideoCurrentTime() - 2.5);
                        setActiveVideoCurrentTime(cur);
                        showToast(`${formatTime(cur)} / ${formatTime(duration)}`);
                    }
                }
                break;
            case 'next':
                if (isSpeedShift) {
                    const rate = Math.min(4, getActiveVideoPlaybackRate() + 0.25);
                    setActiveVideoPlaybackRate(Math.round(rate * 100) / 100);
                    showToast(`倍速: ${getActiveVideoPlaybackRate().toFixed(2)}x`);
                }
                else {
                    const duration = getActiveVideoDuration();
                    if (repeatTimer) {
                        knobVirtualTime = Math.min(duration, knobVirtualTime + 2.5);
                        showToast(`${formatTime(knobVirtualTime)} / ${formatTime(duration)}`);
                        const playBtn = document.querySelector('.btn-play');
                        if (playBtn && duration > 0) {
                            playBtn.style.setProperty('--vg-progress', (knobVirtualTime / duration) * 100);
                        }
                    } else {
                        const cur = Math.min(duration, getActiveVideoCurrentTime() + 2.5);
                        setActiveVideoCurrentTime(cur);
                        showToast(`${formatTime(cur)} / ${formatTime(duration)}`);
                    }
                }
                break;
            case 'resetSpeed':
                if (isSpeedShift) {
                    setActiveVideoPlaybackRate(1.0);
                    showToast("原速 1.0x");
                } else {
                    setActiveVideoCurrentTime(0);
                    showToast("回到开头");
                }
                break;
            case 'togglePlay':
                getActiveVideoPaused() ? executeVideoPlay() : executeVideoPause();
                break;
            case 'toggleMute': {
                const muted = !getActiveVideoMuted();
                setActiveVideoMuted(muted);
                btn.classList.toggle('active', muted);
                break;
            }
            case 'toggleSpeedShift':
                isSpeedShift = !isSpeedShift;
                btn.classList.toggle('active', isSpeedShift);
                hud.querySelector('.btn-left').textContent = isSpeedShift ? "🐢" : "⏪";
                hud.querySelector('.btn-right').textContent = isSpeedShift ? "🐇" : "⏩";
                hud.querySelector('.btn-reset').textContent = isSpeedShift ? "1️⃣" : "⏮️";
                showToast(isSpeedShift ? "倍速模式" : "进度模式");
                break;
            case 'toggleFS': {
                const v = getActiveVideo();
                if (v) {
                    if (!document.fullscreenElement) {
                        const container = v.closest('.html5-video-container') || v.parentElement;
                        const reqFS = container.requestFullscreen || container.webkitRequestFullscreen || v.requestFullscreen;
                        if (reqFS) reqFS.call(container || v);
                    } else { document.exitFullscreen(); }
                } else {
                    sendCommand('toggleFS');
                }
                break;
            }
        }
    }

    // --- 界面状态同步函数组 ---
    function syncUIState(video) {
        const hud = document.getElementById('vg-gamepad-hud');
        if (!hud) return;

        const playBtn = hud.querySelector('.btn-play');
        if (playBtn) {
            const playIcon = playBtn.querySelector('span');
            if (playIcon) playIcon.textContent = video.paused ? "▶️" : "⏸️";
        }

        if (!isNaN(video.duration) && video.duration > 0) {
            const displayTime = isCurrentlySeeking ? knobVirtualTime : video.currentTime;
            const p = (displayTime / video.duration) * 100;
            if (playBtn) playBtn.style.setProperty('--vg-progress', p);
        }

        const muteBtn = hud.querySelector('.btn-mute');
        if (muteBtn) {
            muteBtn.classList.toggle('active', video.muted);
            const muteIcon = muteBtn.querySelector('span');
            if (muteIcon) muteIcon.textContent = video.muted ? "🔊" : "🔇";
            const volPercent = video.muted ? 0 : (video.volume * 100);
            muteBtn.style.setProperty('--vg-vol-progress', volPercent);
        }

        const speedBtn = hud.querySelector('.btn-speed');
        if (speedBtn) {
            speedBtn.classList.toggle('active', isSpeedShift);
            const speedIcon = speedBtn.querySelector('span');
            if (speedIcon) speedIcon.textContent = isSpeedShift ? "⏲️" : "⚡";
            const speedProgress = (video.playbackRate / 4.0) * 100;
            speedBtn.style.setProperty('--vg-progress', speedProgress);
        }

        const fsBtn = hud.querySelector('.btn-fs');
        if (fsBtn) {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
            fsBtn.classList.toggle('active', isFS);
            const fsIcon = fsBtn.querySelector('span');
            if (fsIcon) fsIcon.textContent = isFS ? "📱" : "📺";
            fsBtn.style.setProperty('--vg-progress', isFS ? 100 : 0);
        }

        const resetBtn = hud.querySelector('.btn-reset');
        if (resetBtn) {
            resetBtn.textContent = isSpeedShift ? "1️⃣" : "⏮️";
        }
    }

    function syncUIStateRemote() {
        const hud = document.getElementById('vg-gamepad-hud');
        if (!hud || !remoteVideoState) return;

        const playBtn = hud.querySelector('.btn-play');
        if (playBtn) {
            const playIcon = playBtn.querySelector('span');
            if (playIcon) playIcon.textContent = remoteVideoState.paused ? "▶️" : "⏸️";
        }

        if (!isNaN(remoteVideoState.duration) && remoteVideoState.duration > 0) {
            const displayTime = isCurrentlySeeking ? knobVirtualTime : remoteVideoState.currentTime;
            const p = (displayTime / remoteVideoState.duration) * 100;
            if (playBtn) playBtn.style.setProperty('--vg-progress', p);
        }

        const muteBtn = hud.querySelector('.btn-mute');
        if (muteBtn) {
            muteBtn.classList.toggle('active', remoteVideoState.muted);
            const muteIcon = muteBtn.querySelector('span');
            if (muteIcon) muteIcon.textContent = remoteVideoState.muted ? "🔊" : "🔇";
            const volPercent = remoteVideoState.muted ? 0 : (remoteVideoState.volume * 100);
            muteBtn.style.setProperty('--vg-vol-progress', volPercent);
        }

        const speedBtn = hud.querySelector('.btn-speed');
        if (speedBtn) {
            speedBtn.classList.toggle('active', isSpeedShift);
            const speedIcon = speedBtn.querySelector('span');
            if (speedIcon) speedIcon.textContent = isSpeedShift ? "⏲️" : "⚡";
            const speedProgress = (remoteVideoState.playbackRate / 4.0) * 100;
            speedBtn.style.setProperty('--vg-progress', speedProgress);
        }

        const fsBtn = hud.querySelector('.btn-fs');
        if (fsBtn) {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
            fsBtn.classList.toggle('active', isFS);
            const fsIcon = fsBtn.querySelector('span');
            if (fsIcon) fsIcon.textContent = isFS ? "📱" : "📺";
            fsBtn.style.setProperty('--vg-progress', isFS ? 100 : 0);
        }

        const resetBtn = hud.querySelector('.btn-reset');
        if (resetBtn) {
            resetBtn.textContent = isSpeedShift ? "1️⃣" : "⏮️";
        }
    }

    // --- 周期检查与同步逻辑 ---
    const checkAndInit = () => {
        if (!isTop) {
            const video = getActiveVideo();
            const shouldReport = video && (video.offsetWidth > window.innerWidth / 3);
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);

            if (shouldReport) {
                restoreVolume(video);
                if (video.controls) video.controls = false;
                window.parent.postMessage({
                    type: 'vg-status',
                    paused: video.paused,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    volume: video.volume,
                    muted: video.muted,
                    playbackRate: video.playbackRate
                }, '*');
            }

            // 在 iframe 全屏下，本地也初始化并显示 HUD 界面
            const hud = document.getElementById('vg-gamepad-hud');
            if (isFS && video) {
                if (!hud) {
                    if (document.body) initUI();
                } else {
                    hud.classList.toggle('vg-fullscreen', true);
                    hud.classList.add('vg-visible');
                    syncUIState(video);
                }
            } else {
                if (hud) {
                    hud.remove();
                }
            }
            return;
        }

        // 主窗口角色
        const video = getActiveVideo();
        const hasRemote = remoteVideoState && (Date.now() - lastRemoteTime < 2000);
        const shouldShow = (video && (video.offsetWidth > window.innerWidth / 3)) || hasRemote;
        const hud = document.getElementById('vg-gamepad-hud');

        if (shouldShow) {
            if (video && video.controls) video.controls = false;

            if (!hud) {
                if (document.body) initUI();
            } else {
                const isFS = !!document.fullscreenElement;
                hud.classList.toggle('vg-fullscreen', isFS);
                hud.classList.add('vg-visible');

                if (video) {
                    restoreVolume(video);
                    syncUIState(video);
                    restoreState(video);
                    if (Date.now() - lastSaveTime > 5000) {
                        saveState();
                    }
                } else if (remoteVideoState) {
                    syncUIStateRemote();
                    // 远程状态下的保存与恢复逻辑
                    const key = getStorageKey();
                    if (key !== lastPersistenceKey && !isNaN(remoteVideoState.duration) && remoteVideoState.duration > 0) {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            try {
                                const state = JSON.parse(raw);
                                if (Date.now() - state.ts < 604800000 && state.time < remoteVideoState.duration - 5) {
                                    sendCommand('setCurrentTime', state.time);
                                    sendCommand('setVolume', state.vol);
                                    showToast(`已恢复 1 周内进度: ${formatTime(state.time)}`);
                                }
                            } catch (e) { }
                        }
                        lastPersistenceKey = key;
                    }
                    if (Date.now() - lastSaveTime > 5000 && !isNaN(remoteVideoState.duration) && remoteVideoState.duration > 10) {
                        const state = {
                            time: remoteVideoState.currentTime,
                            vol: remoteVideoState.volume,
                            ts: Date.now()
                        };
                        localStorage.setItem(key, JSON.stringify(state));
                        lastSaveTime = Date.now();
                    }
                }
            }
        } else {
            if (hud) {
                hud.classList.remove('vg-visible');
                hud.classList.remove('vg-idle');
            }
        }
    };

    // --- 事件监听与消息分发 ---
    if (isTop) {
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'vg-status') {
                remoteVideoState = e.data;
                remoteSource = e.source;
                remoteOrigin = e.origin;
                lastRemoteTime = Date.now();
            }
        });
    } else {
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'vg-command') {
                const video = getActiveVideo();
                if (!video) return;
                const cmd = e.data;
                switch (cmd.action) {
                    case 'play': video.play(); break;
                    case 'pause': video.pause(); break;
                    case 'setVolume': video.volume = cmd.value; break;
                    case 'setPlaybackRate': video.playbackRate = cmd.value; break;
                    case 'setCurrentTime': video.currentTime = cmd.value; break;
                    case 'setMuted': video.muted = cmd.value; break;
                    case 'seekStart': video.pause(); break;
                    case 'seekEnd':
                        video.currentTime = cmd.value;
                        if (cmd.wasPlayingBeforeSeek) {
                            video.play();
                        }
                        break;
                    case 'toggleFS':
                        if (!document.fullscreenElement) {
                            const container = video.closest('.html5-video-container') || video.parentElement;
                            const reqFS = container.requestFullscreen || container.webkitRequestFullscreen || video.requestFullscreen;
                            if (reqFS) reqFS.call(container || video);
                        } else { document.exitFullscreen(); }
                        break;
                }
            }
        });
    }

    const start = () => { if (document.body) checkAndInit(); else setTimeout(start, 50); };
    start();
    setInterval(checkAndInit, 500);

})();
