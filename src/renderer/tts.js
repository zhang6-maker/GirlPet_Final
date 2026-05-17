// ==================== 语音合成模块 ====================
// 依赖: window.SETTINGS_STORE (通过 window 读取)

let audioQueue = [];
let isAudioPlaying = false;

const MAX_QUEUE_SIZE = 3;          // 最多排队 3 条，避免堆积
const EDGE_TTS_TIMEOUT_MS = 15000;  // Edge‑TTS 单次请求超时 15 秒

// 可选：提前激活浏览器语音（降低首次降级延迟）
(function prewarmSpeechSynthesis() {
    if (window.speechSynthesis) {
        const dummy = new SpeechSynthesisUtterance('');
        dummy.volume = 0;
        dummy.rate = 1;
        window.speechSynthesis.speak(dummy);
    }
})();

function speak(text, { onStart = null, onEnd = null } = {}) {
    // 简单清理文本
    text = text.replace(/\p{Emoji}/gu, '').trim();
    
    // ✅ 新增：移除所有括号及括号内的内容，防止朗读括号
    // 匹配中文全角括号「」、（）、【】以及英文半角括号 ()、[]、{}
    text = text.replace(/[（(][^）)]*[）)]/g, '');
    text = text.replace(/【[^】]*】/g, '');
    text = text.replace(/「[^」]*」/g, '');
    text = text.replace(/\[[^\]]*\]/g, '');   // 英文方括号
    text = text.replace(/\{[^}]*\}/g, '');     // 英文花括号

    // 去掉多余的空格，避免出现“你好，   ”
    text = text.replace(/\s+/g, ' ').trim();
    
    if (!text) {
        if (onEnd) onEnd();
        return;
    }

    // 队列过载保护：超出上限直接丢弃新语音（防止无限堆积）
    if (audioQueue.length >= MAX_QUEUE_SIZE) {
        console.warn(`⚠️ 语音队列已满(${MAX_QUEUE_SIZE})，丢弃: "${text.substring(0, 20)}..."`);
        if (onEnd) onEnd();      // 仍需回调，避免调用方一直等待
        return;
    }

    audioQueue.push({ text, onStart, onEnd });
    console.log(`📥 语音加入队列，当前队列长度: ${audioQueue.length}`);
    if (!isAudioPlaying) {
        processAudioQueue();
    }
}

async function processAudioQueue() {
    if (audioQueue.length === 0) {
        isAudioPlaying = false;
        console.log('✅ 队列已空，停止播放');
        return;
    }

    isAudioPlaying = true;
    const { text, onStart, onEnd } = audioQueue.shift();
    console.log(`▶️ 开始处理语音: "${text.substring(0, 20)}..."`);

    try {
        const cfg = window.SETTINGS_STORE.getAll();
        const ttsUrl = cfg.ttsUrl || 'http://127.0.0.1:8001/synthesize/';
        const ttsVoice = cfg.ttsVoice || 'zh-CN-XiaoyiNeural';

        // ==================== 修改点：带重试的 TTS 请求 ====================
        const MAX_RETRIES = 2;              // 最多重试 2 次（总共 3 次尝试）
        const REQUEST_TIMEOUT = 15000;      // 单次请求超时 15 秒

        let response = null;
        let lastError = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

            try {

                // ===== 新增计时 =====
                console.time('⏱️ [TTS] 合成耗时');

                response = await fetch(ttsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, voice: ttsVoice }),
                    signal: controller.signal
                });

                console.timeEnd('⏱️ [TTS] 合成耗时');

                clearTimeout(timeoutId);   // 请求成功，清除超时

                if (response.ok) {
                    break;                  // 成功，跳出重试循环
                }
                // 服务器返回错误（如 500），不重试，直接抛出
                throw new Error(`Edge‑TTS 返回错误 ${response.status}`);
            } catch (err) {

                // ===== 失败也记录耗时 =====
                console.warn(`⏱️ [TTS] 第${attempt + 1}次请求失败`, err.message);
                // =========================
                
                clearTimeout(timeoutId);
                lastError = err;
                if (attempt < MAX_RETRIES) {
                    // 等一小会儿再试，指数退避：1秒、2秒
                    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                }
            }
        }

        if (!response || !response.ok) {
            throw lastError || new Error('TTS 请求最终失败');
        }
        // ================================================================

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onplay = () => {
            console.log(`🎵 Edge‑TTS 开始播放: "${text.substring(0, 20)}..."`);
            window.STATE.isSpeaking = true;
            if (onStart) onStart();
        };

        audio.onended = () => {
            console.log(`🏁 Edge‑TTS 播放结束: "${text.substring(0, 20)}..."`);
            URL.revokeObjectURL(audioUrl);
            window.STATE.isSpeaking = false;
            if (onEnd) onEnd();
            processAudioQueue();
        };

        audio.onerror = (e) => {
            console.error('❌ Edge‑TTS 音频播放错误:', e);
            URL.revokeObjectURL(audioUrl);
            window.STATE.isSpeaking = false;
            if (onEnd) onEnd();
            processAudioQueue();
        };

        await audio.play();

    } catch (error) {
        // ==================== 修改点：简化降级逻辑 ====================
        console.warn('⚠️ Edge‑TTS 调用失败，降级到浏览器语音', error);
        speakWithBrowserTTS(text, onStart, onEnd);
        // ============================================================
    }
}

function speakWithBrowserTTS(text, onStart, onEnd) {
    if (!window.speechSynthesis) {
        console.warn('❌ 当前浏览器不支持语音合成');
        if (onEnd) onEnd();
        processAudioQueue();
        return;
    }

    // 取消当前任何可能的残留语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;

    let finished = false;   // ✅ 防止 onend 被多次触发

    utterance.onstart = () => {
        console.log(`🎵 浏览器语音开始: "${text.substring(0, 20)}..."`);
        window.STATE.isSpeaking = true;
        if (onStart) onStart();
    };

    utterance.onend = () => {
        if (finished) return;
        finished = true;
        console.log(`🏁 浏览器语音结束: "${text.substring(0, 20)}..."`);
        window.STATE.isSpeaking = false;
        if (onEnd) onEnd();
        processAudioQueue();
    };

    utterance.onerror = (e) => {
        if (finished) return;
        finished = true;
        console.warn('⚠️ 浏览器语音出错:', e);
        window.STATE.isSpeaking = false;
        if (onEnd) onEnd();
        processAudioQueue();
    };

    const setVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang === 'zh-CN' &&
            (v.name.includes('Xiaoxiao') || v.name.includes('Yating') || v.name.includes('Yaoyao'))
        );
        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', setVoice, { once: true });
    } else {
        setVoice();
    }
}

// 导出模块
window.TTS = {
    speak,
    isPlaying: () => isAudioPlaying,
    queueLength: () => audioQueue.length
};