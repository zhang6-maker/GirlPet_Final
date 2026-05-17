// ==================== 入口模块 ====================
// 依赖: window.DEPENDENCIES, window.STORAGE, window.STATE, window.UI, window.DRAG, window.ACTIONS

// ==================== 初始化 ====================
function init() {
    console.log('🚀 寻慧初始化中...');
    // 0. 加载用户配置（必须在所有其他模块使用配置之前）
    window.SETTINGS_STORE.load();
    
    const girl = window.DEPENDENCIES.girl;
    if (!girl) {
        console.error('无法获取 girl 元素');
        return;
    }
    
    // 1. 加载存储数据
    window.STORAGE.loadLearning();
    window.STORAGE.loadHistory();
    
    // 2. 启动自动睡眠检查
    window.STATE.startAutoSleepCheck();

    // 2.5 ✅ 新增：启动提醒后台检查
    window.REMINDERS.startReminderCheck();
    
    // 3. 启动饥饿定时器
    window.DRAG.startHungerTimer();
    
    // 4. 初始化拖拽
    window.DRAG.initGirlDrag();
    window.DRAG.initDragDrop();
    
    // 5. 绑定点击事件
    girl.addEventListener('click', () => {
        console.log('点击了寻慧');
        window.UI.onUserInteract();
        if (window.STATE.idleTimer) clearTimeout(window.STATE.idleTimer);
    
        if (window.STATE.state === 'sleeping') {
            // 1. 进入苏醒状态（播放 wake.gif）
            window.STATE.setState('waking');
    
            // 2. 5秒后伸懒腰
            setTimeout(() => {
                if (window.STATE.state === 'waking') {
                    window.STATE.setState('stretching');
                }
            }, 5000);
    
            // 3. 7秒后恢复 idle
            setTimeout(() => {
                if (window.STATE.state === 'stretching') {
                    window.STATE.setState('idle');
                    window.STATE.startIdleTimer();
                    window.STATE.startRandomPlay();
    
                    window.OLLAMA_CHECKER.performStartupCheck();
    
                    // 重置自动休眠冷却与醒来标记
                    if (window.STATE.resetAutoActionTime) {
                        window.STATE.resetAutoActionTime();
                    }
                    window.STATE.lastWakeUpTime = Date.now();
                }
            }, 7000);
    
            // 4. 8秒后 (idle 已就绪) 再触发 AI 起床气
            setTimeout(() => {
                if (window.STATE.state === 'idle' && !window.STATE.isSpeaking) {
                    window.ACTIONS.sassyWakeUp();
                }
            }, 8000);
    
            return; // 不再弹出输入框
        }
        window.UI.showCustomInput();
    });
    
    // ======== 新增：接受拖拽文件（模板） ========
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.body.addEventListener('drop', async (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.path && file.name && file.name.toLowerCase().endsWith('.pptx')) {
                await window.ACTIONS.receiveTemplate(file.path);
            }
        }
    });
    // ===========================================
    
    // 6. 初始化状态
    window.STATE.setState('idle');
    window.STATE.updatePosition();
    window.STATE.startIdleTimer();
    window.STATE.startRandomPlay();
    
    // 7. 初始欢迎语
    // 旧代码：
    // setTimeout(() => {
    //     window.UI.showBubble('哼！我才不是特意等你呢… 有事快说！', 3000);
    // }, 10000);
    
    // 新代码：等待 TTS 服务在线再说话
    async function waitForTTSService(maxWait = 30000) {
        const started = Date.now();
        const ttsUrl = window.SETTINGS_STORE.getAll().ttsUrl || 'http://127.0.0.1:8001/synthesize/';
        while (Date.now() - started < maxWait) {
            try {
                const res = await fetch(ttsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: 'test', voice: 'zh-CN-XiaoyiNeural' }),
                    signal: AbortSignal.timeout(2000)
                });
                if (res.ok) return true; // TTS 服务正常
            } catch (e) {}
            await new Promise(r => setTimeout(r, 500)); // 等半秒再试
        }
        return false;
    }
    
    (async () => {
        const ready = await waitForTTSService();
        
        if (ready) {
            // ========== 动态启动语 ==========
            // 先显示一个占位气泡，让用户知道在加载
            window.UI.showBubble('🤔 正在苏醒中...', 2000, 'neutral', false);
            
            // 等待一小段时间，确保 Ollama 服务已就绪
            setTimeout(async () => {
                // 收集当前情境信息
                const now = new Date();
                const hour = now.getHours();
                const minute = now.getMinutes();
                const timeStr = `${hour}点${String(minute).padStart(2, '0')}分`;
                
                // 判断时间段
                let timeOfDay;
                if (hour < 6) timeOfDay = '凌晨';
                else if (hour < 9) timeOfDay = '早上';
                else if (hour < 12) timeOfDay = '上午';
                else if (hour < 14) timeOfDay = '中午';
                else if (hour < 18) timeOfDay = '下午';
                else if (hour < 22) timeOfDay = '晚上';
                else timeOfDay = '深夜';
                
                // 获取好感度
                let affectionHint = '';
                if (window.AFFECTION) {
                    const av = window.AFFECTION.getValue();
                    const ap = window.AFFECTION.getPhase();
                    affectionHint = `当前主人对你的好感度是${av}/100，处于"${ap}"阶段。`;
                }
                
            
                // 构建动态 prompt
                // 读取最近启动日期（统一在此处判断，只声明一次 prompt）

                const lastBoot = window.STORAGE.getLastBootDate?.() || '';
                const today = new Date().toLocaleDateString();
                
                let prompt;
                if (lastBoot === today) {
                    const history = window.STORAGE.getChatHistory().slice(-4);
                    const context = history.length > 0
                        ? '重启前你们最后的对话是：\n' + history.map(h => `${h.role === 'user' ? '主人' : '你'}: ${h.content}`).join('\n')
                        : '你刚刚被重启了。';
                    
                    prompt = `（你刚刚被主人重启了。现在是${timeOfDay}，时间大约是${timeStr}。${affectionHint}
                    ${context}
                    请用一句傲娇的话告诉主人“我回来了”，语气中要带着“你刚才跟我聊到一半就重启”的抱怨或嫌弃，但别提起重启一词，只表现出你知道刚刚发生了什么。
                    只输出话语，不要任何解释）`;
                } else {
                    prompt = `（你刚刚被启动了。现在是${timeOfDay}，时间大约是${timeStr}。
                    ${affectionHint}
                    请用1句傲娇、毒舌但又有点期待的话作为开场白，对主人说。
                    要求：
                    - 每次都不一样，要结合时间和好感度
                    - 如果好感度低，语气更冷一点
                    - 如果好感度高，语气更粘人一点
                    - 如果现在是深夜或凌晨，可以吐槽他这么晚还不睡
                    - 只输出话语，不要任何解释）`;
                    window.STORAGE.setLastBootDate(today);
                }
                
            // 调用 AI 生成启动语
                if (window.CHAT && window.CHAT.talkToOllama) {
                    window.CHAT.talkToOllama(prompt, {

                        skipLearning: true, 

                        skipDiary: true,

                        skipIntercept: true,   // 添加这一行，跳过所有内置拦截（提醒、搜索、报时等）

                        onStart: () => {
                            // AI 生成完成，气泡会自动显示
                        },
                        onEnd: () => {
                            // 播放完毕后啥也不做
                        }
                    });
                } else {
                    // 如果 AI 不可用，降级到固定启动语
                    window.UI.showBubble('哼！我才不是特意等你呢… 有事快说！', 3000);
                }
            }, 3000); // 给 Ollama 3秒缓冲时间
            
        } else {
            // TTS 不可用，降级
            window.UI.showBubble('哼！我才不是特意等你呢…（TTS 启动失败，我暂时说不了话）', 5000);
        }
    })();

    // ======== 绑定隐身/显示按钮 ========
    const toggleBtn = document.getElementById('toggleVisibilityBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const girl = window.DEPENDENCIES.girl;
            const bubble = window.DEPENDENCIES.bubble;
            if (!girl) return;

            if (window.STATE.isHidden) {
                // 恢复窗口大小和位置
                window.DEPENDENCIES.ipcRenderer.send('toggle-visibility', false);
                // 显示寻慧
                girl.style.display = 'block';
                girl.style.pointerEvents = 'auto';
                if (bubble) bubble.style.pointerEvents = 'auto';
                toggleBtn.innerHTML = '👁️';   // 睁眼

                // ✅ 恢复按钮默认样式
                toggleBtn.style.fontSize = '20px';
                toggleBtn.style.width = '36px';
                toggleBtn.style.height = '36px';
                toggleBtn.style.background = 'rgba(255,255,255,0.7)';
               
                window.STATE.isHidden = false;
            } else {
                // 隐藏寻慧
                girl.style.display = 'none';
                girl.style.pointerEvents = 'none';
                if (bubble) {
                    bubble.style.display = 'none';
                    bubble.style.pointerEvents = 'none';
                }
                // 缩小窗口为右下角小按钮
                window.DEPENDENCIES.ipcRenderer.send('toggle-visibility', true);
                toggleBtn.innerHTML = '👁️‍🗨️'; // 闭眼

                // ✅ 让隐藏状态下的按钮更大、更醒目
                toggleBtn.style.fontSize = '32px';
                toggleBtn.style.width = '56px';
                toggleBtn.style.height = '56px';
                toggleBtn.style.background = 'rgba(255, 153, 204, 0.9)';  // 粉红色底

                window.STATE.isHidden = true;
            }
        });
    }
    // ===================================

        // ======== 快捷键强制显示寻慧（Ctrl+Shift+H） ========
    window.DEPENDENCIES.ipcRenderer.on('force-show-girl', () => {
        const girl = window.DEPENDENCIES.girl;
        const bubble = window.DEPENDENCIES.bubble;
        if (!girl) return;

        // 显示女孩和气泡
        girl.style.display = 'block';
        girl.style.pointerEvents = 'auto';
        if (bubble) bubble.style.pointerEvents = 'auto';

        // 恢复隐身按钮的样式和文字
        const toggleBtn = document.getElementById('toggleVisibilityBtn');
        if (toggleBtn) {
            toggleBtn.innerHTML = '👁️';
            toggleBtn.style.fontSize = '20px';
            toggleBtn.style.width = '36px';
            toggleBtn.style.height = '36px';
            toggleBtn.style.background = 'rgba(255,255,255,0.7)';
        }

        // 重置隐藏状态标志
        window.STATE.isHidden = false;

        // 通知主进程恢复窗口大小
        window.DEPENDENCIES.ipcRenderer.send('toggle-visibility', false);
    });
    // ===============================================
    
    console.log('✅ 寻慧初始化完成');

    // 自动检测 Ollama 服务状态
    window.OLLAMA_CHECKER.performStartupCheck();


}

// DOM 就绪后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 导出入口模块
window.INDEX = {
    init
};