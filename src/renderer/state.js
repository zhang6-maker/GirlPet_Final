// ==================== 状态管理模块 ====================
// 依赖: window.CONFIG, window.DEPENDENCIES

// 基础状态
let state = 'idle';
let isSpeaking = false;
let currentX = 200, currentY = 200;
let targetX = 200, targetY = 200;
let idleTimer = null, randomPlayTimer = null;

let idleAnimationTimer = null;   // 新增：待机动画切换定时器

let lastStateChangeTime = 0;

// 定时睡觉
let sleepCheckInterval = null;
let lastAutoActionTime = 0;
let lastWakeUpTime = 0;  // 记录上次醒来的时间
let isHidden = false;

let sleepAudio = null;   // 睡觉呼噜音频
let animationFrameId = null;   // 保存 requestAnimationFrame 的返回 ID

// 导出状态对象
window.STATE = {
    // 状态属性
    get state() { return state; },
    get isSpeaking() { return isSpeaking; },
    set isSpeaking(val) { isSpeaking = val; },
    get currentX() { return currentX; },
    set currentX(val) { currentX = val; },
    get currentY() { return currentY; },
    set currentY(val) { currentY = val; },
    get targetX() { return targetX; },
    set targetX(val) { targetX = val; },
    get targetY() { return targetY; },
    set targetY(val) { targetY = val; },
    get idleTimer() { return idleTimer; },
    get randomPlayTimer() { return randomPlayTimer; },
    get lastStateChangeTime() { return lastStateChangeTime; },
    
    get isHidden() { return isHidden; },
    set isHidden(val) { isHidden = val; },

    // ✅ 新增：醒来时间记录（用于醒来后宽限期，防止立即又睡）
    _lastWakeUpTime: 0,
    get lastWakeUpTime() { return lastWakeUpTime; },
    set lastWakeUpTime(val) { lastWakeUpTime = val; },

    // 可变工作/床位位置（内部变量 + getter/setter）
    _workPos: { x: 300, y: 300 },
    _bedPos: { x: 200, y: 400 },

    get workPos() { return this._workPos; },
    set workPos(val) { this._workPos = val; },

    get bedPos() { return this._bedPos; },
    set bedPos(val) { this._bedPos = val; },

    // 方法
    setState,
    updatePosition,
    moveStep,
    startIdleTimer,
    startRandomPlay,
    checkAutoSleep,
    startAutoSleepCheck,

    startIdleAnimationTimer,
    stopIdleAnimationTimer,

    // ✅ 新增：重置自动休眠冷却，防止立即自动去睡觉
    resetAutoActionTime: function() {
        lastAutoActionTime = Date.now();
    }
};

// ==================== 状态控制 ====================
function setState(newState) {
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;

    const oldState = state;

    // 如果状态没变，直接返回，避免冷却警告
    if (state === newState) return;

    const now = Date.now();
    const minDuration = window.CONFIG.STATE_CONFIG.minDuration;

    // 豁免条件：
    const isWakeUp = (state === 'sleeping' && newState === 'idle');           // 手动唤醒
    const isWakingEnd = (state === 'waking' && newState === 'idle');          // 醒来动画结束
    const isStartWaking = (newState === 'waking');                            // 开始醒来动画
    // 进入短暂行为状态（喂食、工作、玩耍、走路）
    const isTemporaryState = (newState === 'eating' || newState === 'working' || newState === 'playing' || newState === 'walking' ||  newState === 'stretching' || newState === 'dancing');
    // 当前是短暂状态，且目标状态是 idle（恢复正常）—— 修改点：不再豁免此情况，以避免频繁切换
    // const isShortState = (state === 'eating' || state === 'working' || state === 'playing' || state === 'walking');
    // const isReturnToIdle = (isShortState && newState === 'idle');   // 已移除

    const isWalkingToSleep = (state === 'walking' && newState === 'sleeping');
    // 移除了 isReturnToIdle，因此从短暂状态切回 idle 必须满足最小持续时间
    const isEatingToIdle = (state === 'eating' && newState === 'idle');   // 允许喂食后自动恢复
    // 短暂状态表，切回 idle 时跳过冷却
    const shortStates = ['eating', 'working', 'playing', 'walking', 'stretching', 'dancing'];
    const isShortStateReturnToIdle = shortStates.includes(state) && newState === 'idle';
    const bypassLock = isWakeUp || isWakingEnd || isStartWaking || isTemporaryState || isWalkingToSleep || isEatingToIdle || isShortStateReturnToIdle;

    if (!bypassLock && now - lastStateChangeTime < minDuration) {
        console.log(`状态切换被阻止: 距离上次切换仅 ${now - lastStateChangeTime}ms`);
        return;
    }

    console.log('setState:', newState);
    state = newState;
    lastStateChangeTime = now;
    
    if (newState === 'idle') {
    // 50% 概率使用 idle2
        girl.src = Math.random() < 0.5 
            ? window.CONFIG.imgMap.idle2 
            : window.CONFIG.imgMap.idle;
    } else {
        girl.src = window.CONFIG.imgMap[newState] || window.CONFIG.imgMap.idle;
    }

    console.log(`切换到动画: ${girl.src}`);   // 新增的调试日志

    // 在 setState 函数内部的适当位置（例如在加载图片后）
    if (newState === 'idle') {
        startIdleAnimationTimer();   // 启动待机动画切换
    } else {
        stopIdleAnimationTimer();    // 离开 idle 时清除
    }

    if (state === 'sleeping') girl.style.opacity = '0.8';
    else girl.style.opacity = '1';

    // ========== 睡眠呼噜音频控制 ==========
    if (newState === 'sleeping') {
        // ✅ 进入睡眠时，取消饥饿相关行为
        if (window.DRAG && window.DRAG.hideFoodIcon) {
            window.DRAG.hideFoodIcon();
        }
        if (window.DRAG && window.DRAG.stopHungerTimer) {
            window.DRAG.stopHungerTimer();
        }

        // 开始循环播放 sleep.wav
        if (!sleepAudio) {
            sleepAudio = new Audio('sleep.wav');  // 文件需放在项目根目录
            sleepAudio.loop = true;
        }
        sleepAudio.currentTime = 0;
        sleepAudio.play().catch(err => console.warn('播放 sleep.wav 失败:', err));
    } else if (oldState === 'sleeping' && newState !== 'sleeping') {
        // 退出睡眠，停止播放
        if (sleepAudio) {
            sleepAudio.pause();
            sleepAudio.currentTime = 0;

            sleepAudio = null;   // 释放 Audio 对象，下次睡眠时重新创建
        }
    }
    // ========================================

        // 从睡眠醒来时检查节日
    if (oldState === 'sleeping' && newState === 'idle') {
        setTimeout(() => {
            if (window.ACTIONS && window.ACTIONS.festivalGreet) {
                window.ACTIONS.festivalGreet();
            }
        }, 1000);
    }

}

// ==================== 位置控制 ====================
function updatePosition() {
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;

    girl.style.left = currentX + 'px';
    girl.style.top = currentY + 'px';
}

function moveStep() {

    // ===== 新增：防止动画叠加 =====
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (Math.abs(currentX - targetX) < 2 && Math.abs(currentY - targetY) < 2) {
        currentX = targetX;
        currentY = targetY;
        updatePosition();
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    if (Math.abs(currentX - targetX) < 2 && Math.abs(currentY - targetY) < 2) {
        currentX = targetX;
        currentY = targetY;
        updatePosition();

         // ✅ 停止无用的动画帧循环
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (state === 'walking') {
            // 使用可变 workPos / bedPos（已由 actions 模块设置）
            const wp = window.STATE.workPos;
            const bp = window.STATE.bedPos;
             if (Math.abs(targetX - wp.x) < 2 && Math.abs(targetY - wp.y) < 2){
                setState('working');
                window.UI.showBubble('💻 开始工作...');
                setTimeout(() => {
                    if (window.STATE.state === 'working') {
                        window.STATE.setState('stretching');
                        window.UI.showBubble('😌 工作完成，伸个懒腰～');
                        window.STORAGE.autoDiary('work');
                        // 2 秒后恢复到 idle
                        setTimeout(() => {
                            if (window.STATE.state === 'stretching') {
                                window.STATE.setState('idle');
                                window.STATE.startIdleTimer();
                            }
                        }, 2000);
                    }
                }, 3000);
            } else if (Math.abs(targetX - bp.x) < 2 && Math.abs(targetY - bp.y) < 2) {
                console.log('💤 到达床位，进入睡觉状态');
                setState('sleeping');
                //window.UI.showBubble('😴 呼噜...');
                if (randomPlayTimer) clearTimeout(randomPlayTimer);
                window.STORAGE.autoDiary('sleep');
            } else {
                setState('idle');
                startIdleTimer();
            }
        }
        return;
    }
    currentX += (targetX - currentX) * 0.1;
    currentY += (targetY - currentY) * 0.1;
    updatePosition();
    
    animationFrameId = requestAnimationFrame(moveStep);

}

// ==================== 定时器 ====================
function startIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    // 仅当处于 idle 状态且未说话时启动空闲定时器
    if (state !== 'idle' || isSpeaking) return;
    const timeout = window.CONFIG.STATE_CONFIG.idleTimeout;
    idleTimer = setTimeout(() => {
        //if (state === 'idle' && !isSpeaking) window.ACTIONS.goToBed(true);

        if (state === 'idle' && !isSpeaking) {
            if (window.AFFECTION) window.AFFECTION.change(-1, '冷落太久');
            window.ACTIONS.goToBed(true);
        }
        
    }, timeout);
}

// ==================== 待机动画随机切换 ====================
function startIdleAnimationTimer() {
    stopIdleAnimationTimer(); // 防止重复定时器
    const interval = 30000;   // 30 秒切换一次
   
    function switchAnimation() {
        // 仅在 idle 状态且未说话时切换
        if (state === 'idle' && !isSpeaking) {
            const girl = window.DEPENDENCIES.girl;
            if (!girl) return;
    
            const rand = Math.random();
            let newSrc;
    
            if (rand < 0.1) {
                // 10% 概率：思考动画 + 触发大模型自言自语
                newSrc = window.CONFIG.imgMap.think;
            
                // ---------- 冷却控制（4~6分钟随机，避免死板）----------
                const now = Date.now();
                const cooldown = 4 * 60 * 1000 + Math.random() * 2 * 60 * 1000; // 4~6分钟随机
                if (!window._lastMusingTime || (now - window._lastMusingTime > cooldown)) {
                    window._lastMusingTime = now;
                    console.log('🤔 [自言自语] 冷却通过，开始请求大模型...');
            
                    // 异步请求大模型生成独白
                    window.CHAT.generateMusing('').then((musing) => {
                        console.log('📝 [自言自语] 模型返回内容:', musing);
                        console.log('📍 [自言自语] 当前状态:', state, '是否说话中:', isSpeaking);
            
                        if (musing && state === 'idle' && !isSpeaking) {
                            console.log('✅ [自言自语] 满足条件，显示内心戏');
                            window.UI.showInnerThought(musing, 3500);
                        } else if (!musing && state === 'idle' && !isSpeaking) {
                            // 兜底：即使模型没返回，也从小本本里找句话
                            const fallbacks = [
                                '唔…去哪了？',
                                '好困啊，发会儿呆…',
                                '有点无聊呢…',
                                '哼，我才没有在想你呢…'
                            ];
                            const msg = fallbacks[Math.floor(Math.random() * fallbacks.length)];
                            console.log('📋 [自言自语] 使用兜底文本:', msg);
                            window.UI.showInnerThought(msg, 3000);
                        } else {
                            console.log('❌ [自言自语] 未显示，原因:', {
                                空文本: !musing,
                                非idle状态: state !== 'idle',
                                正在说话: isSpeaking
                            });
                        }
                    }).catch(err => {
                        console.error('🔥 [自言自语] 请求异常:', err.message);
                        // 请求异常时，如果还在idle且未说话，也兜底
                        if (state === 'idle' && !isSpeaking) {
                            const fallbacks = ['网络好像不太好…算了，不想说话…'];
                            window.UI.showInnerThought(fallbacks[0], 3000);
                        }
                    });
                } else {
                    console.log('⏰ [自言自语] 冷却中，距上次触发',
                        now - window._lastMusingTime, 'ms');
                }
            
            } else if (rand < 0.55) {
                // 45% 概率：默认待机
                newSrc = window.CONFIG.imgMap.idle;
            } else {
                // 45% 概率：第二待机动画
                newSrc = window.CONFIG.imgMap.idle2;
            }
            
            girl.src = newSrc;
        }
        // 继续下一次循环
        idleAnimationTimer = setTimeout(switchAnimation, interval);
    }

    idleAnimationTimer = setTimeout(switchAnimation, interval);
}

function stopIdleAnimationTimer() {
    if (idleAnimationTimer) {
        clearTimeout(idleAnimationTimer);
        idleAnimationTimer = null;
    }
}

function startRandomPlay() {
    if (randomPlayTimer) clearTimeout(randomPlayTimer);
    const min = window.CONFIG.STATE_CONFIG.randomPlayMin;
    const max = window.CONFIG.STATE_CONFIG.randomPlayMax;
    randomPlayTimer = setTimeout(() => {
        if (state === 'idle' && !isSpeaking) window.ACTIONS.play();
        startRandomPlay();
    }, min + Math.random() * (max - min));
}

// ==================== 自动睡眠检查 ====================
function checkAutoSleep() {
    const now = Date.now();
    // 避免频繁切换，至少 50 分钟内不重复触发自动睡觉/醒来
    if (now - lastAutoActionTime < 3000000) return;

    // 醒来后 30 分钟内不自动睡觉
    const WAKE_UP_GRACE = 30 * 60 * 1000;
    if (window.STATE.lastWakeUpTime > 0 && now - window.STATE.lastWakeUpTime < WAKE_UP_GRACE) {
        return;
    }

    // 如果正在说话，不打断
    if (window.STATE.isSpeaking) return;

    const current = new Date();
    const currentHour = current.getHours();
    const currentMinute = current.getMinutes();
    const currentValue = currentHour * 60 + currentMinute;

    // ===== 修改开始：从用户设置读取睡觉/起床时间，若无则使用 CONFIG 默认值 =====
    const userSettings = window.SETTINGS_STORE?.getAll() || {};
    const sleepHour   = userSettings.sleepTimeHour   ?? window.CONFIG.SLEEP_CONFIG.sleepTime.hour;
    const sleepMinute = userSettings.sleepTimeMinute ?? window.CONFIG.SLEEP_CONFIG.sleepTime.minute;
    const wakeHour    = userSettings.wakeTimeHour    ?? window.CONFIG.SLEEP_CONFIG.wakeTime.hour;
    const wakeMinute  = userSettings.wakeTimeMinute  ?? window.CONFIG.SLEEP_CONFIG.wakeTime.minute;
    const sleepValue  = sleepHour * 60 + sleepMinute;
    const wakeValue   = wakeHour * 60 + wakeMinute;
    // ===== 修改结束 =====

    console.log(`[定时] 当前时间 ${currentHour}:${currentMinute}, 状态: ${state}`);

    if (sleepValue === wakeValue) return;

    let isSleepTime = false;
    if (sleepValue > wakeValue) {
        isSleepTime = (currentValue >= sleepValue) || (currentValue < wakeValue);
    } else {
        isSleepTime = (currentValue >= sleepValue && currentValue < wakeValue);
    }

    if (isSleepTime && state === 'idle') {
        console.log('✅ 条件满足，自动去睡觉');
        lastAutoActionTime = now;
        const girl = window.DEPENDENCIES.girl;
        const maxX = window.innerWidth - (girl ? girl.offsetWidth : 150);
        const maxY = window.innerHeight - (girl ? girl.offsetHeight : 150);
        const targetPos = {
            x: Math.min(window.CONFIG.baseBedPos.x, maxX),
            y: Math.min(window.CONFIG.baseBedPos.y, maxY)
        };
        window.STATE.bedPos = targetPos;
        window.STATE.targetX = targetPos.x;
        window.STATE.targetY = targetPos.y;
        window.STATE.setState('walking');
        window.STATE.moveStep();
    }
    else if (state === 'sleeping' && !isSleepTime && Date.now() - lastStateChangeTime >= window.CONFIG.STATE_CONFIG.minDuration) {
        console.log('✅ 自动醒来，开始苏醒动画');
        lastAutoActionTime = now;

        setState('waking');
        window.UI.showBubble('🌞 我醒啦~', 3500, 'neutral', false);

        setTimeout(() => {
            if (state === 'waking') {
                setState('stretching');
                window.UI.showBubble('🙆 伸个懒腰～', 2500, 'neutral', false);
            }
        }, 2500);

        setTimeout(() => {
            if (state === 'stretching') {
                setState('idle');
                lastAutoActionTime = Date.now();
                window.STATE.lastWakeUpTime = Date.now();
                startIdleTimer();
                startRandomPlay();
            }
        }, 4500);

        window.STORAGE.autoDiary('wake');
    }
}

function startAutoSleepCheck() {
    if (sleepCheckInterval) clearInterval(sleepCheckInterval);
    const interval = window.CONFIG.SLEEP_CONFIG.checkInterval;
    sleepCheckInterval = setInterval(checkAutoSleep, interval);
}