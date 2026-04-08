// ==================== 引入依赖 ====================
const { ipcRenderer, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const PptxGenJS = require('pptxgenjs');   // PPT 生成库

// ==================== DOM 元素 ====================
const girl = document.getElementById('girl');
const bubble = document.getElementById('bubble');

// ==================== 基础状态 ====================
let state = 'idle';
let isSpeaking = false;   // 是否正在语音播放中
let currentX = 200, currentY = 200;
let targetX = 200, targetY = 200;
let idleTimer = null, randomPlayTimer = null;

let baseWorkPos = { x: 300, y: 300 };
let baseBedPos = { x: 200, y: 400 };
let workPos = { ...baseWorkPos };
let bedPos = { ...baseBedPos };

const imgMap = {
    idle: 'images/idle.gif',
    walking: 'images/walk.gif',
    working: 'images/work.gif',
    sleeping: 'images/sleep.gif',
    playing: 'images/play.gif',
    playing2: 'images/play2.gif',
    eating: 'images/eat.gif',
    waking: 'images/wake.gif'
};

// ==================== 日记功能 ====================
const DIARY_FILE = path.join(os.homedir(), '.girlpet_diary.txt');

function writeDiary(content) {
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
    const entry = `[${timestamp}] ${content}\n`;
    try {
        fs.appendFileSync(DIARY_FILE, entry, 'utf8');
        console.log('日记记录:', entry);
    } catch (err) {
        console.error('写入日记失败:', err);
    }
}

function readDiary() {
    try {
        if (fs.existsSync(DIARY_FILE)) {
            return fs.readFileSync(DIARY_FILE, 'utf8');
        } else {
            return '还没有日记记录呢～';
        }
    } catch (err) {
        console.error('读取日记失败:', err);
        return '日记读取失败';
    }
}

function reactToDiaryView() {
    const reactions = [
        '😳 哎呀，被你发现我的小秘密了...',
        '😊 你居然偷偷看我的日记！不过...很开心～',
        '😏 哼！看就看吧，反正写的都是你～',
        '🤗 以后我们可以一起写日记哦！',
        '😜 下次要提前告诉我，我打扮一下日记本～'
    ];
    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
    showBubble(randomReaction, 4000, 'neutral', true);
}

function autoDiary(action, detail = '') {
    const userName = '姐姐';
    let content = '';
    switch(action) {
        case 'feed': content = `${userName} 喂我吃东西，好开心～`; break;
        case 'work': content = `${userName} 让我去工作，我努力完成了任务！`; break;
        case 'play': content = `${userName} 陪我玩耍，今天超有趣！`; break;
        case 'sleep': content = `到点睡觉啦，${userName} 晚安～`; break;
        case 'talk': content = `和 ${userName} 聊天：${detail}`; break;
        case 'wake': content = `醒来啦，新的一天！`; break;
        case 'search': content = `${userName} 让我搜索“${detail}”`; break;
        case 'gomoku': content = `和 ${userName} 下五子棋`; break;
        case 'checkers': content = `和 ${userName} 下跳棋`; break;
        default: content = `${userName} 和我互动了～`;
    }
    writeDiary(content);
}

async function handleViewDiary() {
    const diaryContent = readDiary();
    const preview = diaryContent.length > 200 ? diaryContent.substring(0, 200) + '...' : diaryContent;
    showBubble(`📔 我的日记：\n${preview}`, 8000, 'neutral', false);
    reactToDiaryView();
    ipcRenderer.send('reply-to-mobile', `日记内容：\n${diaryContent}`);
}


// ==================== PPT 生成功能 ====================
async function generatePPT(topic) {
    console.log('generatePPT 被调用，主题:', topic);  // 调试日志
    if (!topic || topic.trim() === '') {
        showBubble('请告诉我PPT的主题是什么呀？', 2000);
        return;
    }
    showBubble(`📊 正在为你生成关于“${topic}”的PPT...`, 2000, 'neutral', false);
    try {
        const pptx = new PptxGenJS();
        let slide = pptx.addSlide();
        slide.addText(topic, { x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 32, bold: true, align: 'center' });
        slide.addText('由寻慧自动生成', { x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 18, align: 'center' });
        slide = pptx.addSlide();
        slide.addText('介绍', { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true });
        slide.addText(`这是关于“${topic}”的演示文稿。你可以根据需要修改内容。`, { x: 0.5, y: 1.2, w: 9, h: 2, fontSize: 16 });
        slide = pptx.addSlide();
        slide.addText('特点', { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true });
        slide.addText('• 自动生成\n• 可编辑\n• 由AI小女孩创建', { x: 0.5, y: 1.2, w: 9, h: 2, fontSize: 16 });
        const desktopPath = path.join(os.homedir(), 'Desktop', `关于${topic}.pptx`);
        await pptx.writeFile({ fileName: desktopPath });
        showBubble(`✅ PPT已生成并保存到桌面：${desktopPath}`, 5000, 'neutral', true);
        autoDiary('talk', `生成了关于“${topic}”的PPT`);
    } catch (err) {
        console.error('生成PPT详细错误:', err);
        showBubble(`😵 PPT生成失败: ${err.message}`, 5000, 'neutral', true);
    }
}

// ==================== 定时睡觉配置 ====================
let sleepCheckInterval = null;
const sleepTime = { hour: 22, minute: 0 };
const wakeTime = { hour: 7, minute: 0 };


function checkAutoSleep() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentValue = currentHour * 60 + currentMinute;
    const sleepValue = sleepTime.hour * 60 + sleepTime.minute;
    const wakeValue = wakeTime.hour * 60 + wakeTime.minute;
    console.log(`[定时] 当前时间 ${currentHour}:${currentMinute}, 状态: ${state}, 当前值: ${currentValue}, 睡觉值: ${sleepValue}, 起床值: ${wakeValue}`);

    // 判断是否在睡觉时间段内（支持跨天）
    let isSleepTime = false;
    if (sleepValue > wakeValue) {
        // 跨天：例如 22:00 到 7:00
        isSleepTime = (currentValue >= sleepValue) || (currentValue < wakeValue);
    } else {
        isSleepTime = (currentValue >= sleepValue && currentValue < wakeValue);
    }

    if (isSleepTime && state === 'idle') {
        console.log('✅ 条件满足，自动去睡觉');
        goToBed();
    } else if (state === 'sleeping' && !isSleepTime) {
        // 不在睡觉时间段内且正在睡觉 → 自动醒来
        console.log('✅ 自动醒来（时间已过睡觉时段）');
        setState('waking');
        showBubble('🌞 我醒啦~', 2500, 'neutral', false);
        setTimeout(() => {
            if (state === 'waking') setState('idle');
            startIdleTimer();
        }, 2500);
        autoDiary('wake');
    } else {
        console.log('❌ 条件不满足：', { isSleepTime, stateIsIdle: state === 'idle' });
    }
}

function startAutoSleepCheck() {
    if (sleepCheckInterval) clearInterval(sleepCheckInterval);
    sleepCheckInterval = setInterval(() => {
        checkAutoSleep();
    }, 60000);
}


// ==================== 语音输出（更自然甜美） ====================

function speak(text, onEnd = null) {
    if (!window.speechSynthesis) {
        console.warn('当前浏览器不支持语音合成');
        if (onEnd) onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    isSpeaking = true;   // 开始说话
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    
    const setVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang === 'zh-CN' && (v.name.includes('Xiaoxiao') || v.name.includes('Yating') || v.name.includes('Yaoyao') || v.name.includes('Google')));
        if (preferred) utterance.voice = preferred;
        utterance.onend = () => {
            isSpeaking = false;   // 说话结束
            if (onEnd) onEnd();
        };
        window.speechSynthesis.speak(utterance);
    };
    
    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', setVoice);
    } else {
        setVoice();
    }
}

// ==================== 辅助函数 ====================
function updatePosition() {
    girl.style.left = currentX + 'px';
    girl.style.top = currentY + 'px';
}

let currentEmotionType = null;
let emotionTimer = null;


function showBubble(text, duration = 2000, emotionType = 'neutral', speakIt = true) {
    bubble.innerText = text;
    // 先临时显示以便获取真实尺寸（但会导致闪烁，我们采用更优雅的方式）
    // 方法：设置文本后，强制重新布局，再测量
    bubble.style.display = 'block';
    bubble.style.visibility = 'hidden';  // 隐藏但占位，用于测量
    const bubbleRect = bubble.getBoundingClientRect();
    const bubbleWidth = bubbleRect.width;
    const bubbleHeight = bubbleRect.height;
    
    const girlRect = girl.getBoundingClientRect();
    // 默认放在小女孩正上方居中
    let left = girlRect.left + (girlRect.width / 2) - (bubbleWidth / 2);
    let top = girlRect.top - bubbleHeight - 10;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 水平边界修正
    if (left < 5) left = 5;
    if (left + bubbleWidth > viewportWidth - 5) left = viewportWidth - bubbleWidth - 5;
    
    // 垂直边界修正：如果上方不够，则放在下方
    if (top < 5) {
        top = girlRect.bottom + 10;
    }
    // 如果下方也不够，则放在屏幕中央（兜底）
    if (top + bubbleHeight > viewportHeight - 5) {
        top = (viewportHeight - bubbleHeight) / 2;
    }
    
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
    bubble.style.visibility = 'visible';
    
    // 情绪学习计时（保持不变）
    currentEmotionType = emotionType;
    if (emotionTimer) clearTimeout(emotionTimer);
    emotionTimer = setTimeout(() => {
        if (currentEmotionType) {
            updateEmotionPreference(currentEmotionType, false);
            currentEmotionType = null;
        }
    }, duration);
    setTimeout(() => {
        if (bubble.innerText === text) bubble.style.display = 'none';
    }, duration);
    if (speakIt && text && !text.includes('思考中')) {
        speak(text);
    }
}

function setState(newState) {
    console.log('setState:', newState);
    state = newState;
    girl.src = imgMap[state] || imgMap.idle;
    if (state === 'sleeping') girl.style.opacity = '0.8';
    else girl.style.opacity = '1';
}

function clampTargetPos(pos) {
    const maxX = window.innerWidth - girl.offsetWidth;
    const maxY = window.innerHeight - girl.offsetHeight;
    return {
        x: Math.min(Math.max(pos.x, 0), maxX),
        y: Math.min(Math.max(pos.y, 0), maxY)
    };
}

function moveStep() {
    if (Math.abs(currentX - targetX) < 2 && Math.abs(currentY - targetY) < 2) {
        currentX = targetX;
        currentY = targetY;
        updatePosition();
        if (state === 'walking') {
            if (targetX === workPos.x && targetY === workPos.y) {
                setState('working');
                showBubble('💻 开始工作...');
                setTimeout(() => {
                    setState('idle');
                    showBubble('😌 工作完成，伸个懒腰～');
                    startIdleTimer();
                    autoDiary('work');
                }, 3000);
            } else if (targetX === bedPos.x && targetY === bedPos.y) {
                setState('sleeping');
                showBubble('😴 呼噜...');
                if (randomPlayTimer) clearTimeout(randomPlayTimer);
                autoDiary('sleep');
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
    requestAnimationFrame(moveStep);
}

function goToWork() {
    console.log('goToWork triggered');
    if (state === 'walking') {
        showBubble('正在移动中，稍等...', 1000);
        return;
    }
    if (state === 'sleeping') {
        setState('idle');
        showBubble('🌞 醒来啦！');
        startIdleTimer();
        setTimeout(() => goToWork(), 500);
        return;
    }
    if (state === 'working') {
        showBubble('已经在工作啦！', 1000);
        return;
    }
    const maxX = window.innerWidth - girl.offsetWidth;
    const maxY = window.innerHeight - girl.offsetHeight;
    workPos = {
        x: Math.min(baseWorkPos.x, maxX),
        y: Math.min(baseWorkPos.y, maxY)
    };
    console.log('工作点:', workPos);
    setState('walking');
    showBubble('🚶 去工作...', 1500);
    targetX = workPos.x;
    targetY = workPos.y;
    moveStep();
}

function goToBed() {
    if (state === 'walking') {
        showBubble('正在移动中，稍等...', 1000);
        return;
    }
    if (state === 'sleeping') return;
    const maxX = window.innerWidth - girl.offsetWidth;
    const maxY = window.innerHeight - girl.offsetHeight;
    bedPos = {
        x: Math.min(baseBedPos.x, maxX),
        y: Math.min(baseBedPos.y, maxY)
    };
    setState('walking');
    showBubble('🚶 去睡觉...', 1500);
    targetX = bedPos.x;
    targetY = bedPos.y;
    moveStep();
}

function play() {
    if (state === 'walking' || state === 'sleeping') return;
    if (isSpeaking) {
        // 延迟1秒后再试
        setTimeout(() => play(), 1000);
        return;
    }
    const isPlay2 = Math.random() < 0.5;
    const animFile = isPlay2 ? imgMap.playing2 : imgMap.playing;
    state = 'playing';
    girl.src = animFile;
    girl.style.opacity = '1';
    
    // 随机选择哼歌或笑声，不显示“玩耍中”
    const actions = [
        { text: '♪ 哼哼～ ♪', sound: '哼哼哼～' },
        { text: '😄 哈哈哈', sound: '哈哈哈' },
        { text: '🎵 啦啦啦～', sound: '啦啦啦～' },
        { text: '😊 嘻嘻', sound: '嘻嘻' },
        { text: '🎶 哒哒哒～', sound: '哒哒哒～' }
    ];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    showBubble(randomAction.text, 2000, 'neutral', false);
    speak(randomAction.sound);
    
    setTimeout(() => {
        if (state === 'playing') {
            state = 'idle';
            girl.src = imgMap.idle;
            startIdleTimer();
        }
    }, 5000);
    autoDiary('play');
}

// ==================== 唱歌功能（支持任意歌名 + 学习） ====================
const LYRICS_FILE = path.join(os.homedir(), '.girlpet_lyrics.json');

function loadLyrics() {
    try {
        if (fs.existsSync(LYRICS_FILE)) {
            const data = fs.readFileSync(LYRICS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch(e) { console.error('加载歌词库失败', e); }
    return {};
}

function saveLyrics(lyricsDB) {
    try {
        fs.writeFileSync(LYRICS_FILE, JSON.stringify(lyricsDB, null, 2), 'utf8');
    } catch(e) { console.error('保存歌词失败', e); }
}

function teachSong(songName, lyricText) {
    if (!songName || !lyricText) {
        showBubble('请告诉我歌名和歌词，例如：教我唱 小星星 一闪一闪亮晶晶...', 4000);
        return;
    }
    const lyricsDB = loadLyrics();
    lyricsDB[songName] = lyricText;
    saveLyrics(lyricsDB);
    showBubble(`📖 学会啦！下次你说“唱 ${songName}”我就会唱了～`, 4000, 'neutral', true);
    autoDiary('talk', `学会了新歌《${songName}》`);
}


let isSinging = false;  // 全局标志，防止唱歌时被打断

async function singSong(songName) {
    if (!songName) {
        showBubble('你想听什么歌呀？', 2000);
        return;
    }
    if (isSinging) {
        showBubble('等我唱完这首再点歌吧～', 2000);
        return;
    }
    // 唱歌期间清除所有定时器，防止自动动作
    if (idleTimer) clearTimeout(idleTimer);
    if (randomPlayTimer) clearTimeout(randomPlayTimer);
    
    const lyricsDB = loadLyrics();
    if (lyricsDB[songName]) {
        const lyrics = lyricsDB[songName];
        isSinging = true;
        showBubble(`🎤 唱《${songName}》：${lyrics}`, 30000, 'neutral', false);
        // 播放语音，结束后恢复定时器并清除标志
        speak(lyrics, () => {
            isSinging = false;
            startIdleTimer();
            startRandomPlay();
        });
        autoDiary('talk', `唱了《${songName}》`);
    } else {
        showBubble(`😢 我还没学会《${songName}》，你可以教我吗？\n输入：教我唱 ${songName} 歌词内容`, 5000, 'neutral', true);
        startIdleTimer();
        startRandomPlay();
    }
}

function feed() {
    if (state === 'walking' || state === 'sleeping') return;
    setState('eating');
    showBubble('😋 好吃！谢谢你～', 2000);
    setTimeout(() => {
        if (state === 'eating') setState('idle');
        startIdleTimer();
    }, 2000);
    autoDiary('feed');
}

// ==================== 报时 ====================
function tellTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    let timeStr = `现在时间是 ${hour} 点 ${minute} 分`;
    if (minute === 0) timeStr = `现在时间是 ${hour} 点整`;
    showBubble(`🕰️ ${timeStr}`, 3000);
}

// ==================== 联网搜索 ====================
async function searchWeb(keyword) {
    if (!keyword || keyword.trim() === '') {
        showBubble('你想搜索什么呀？', 2000);
        return;
    }
    const previousState = state;
    setState('working');
    showBubble(`🔍 正在搜索“${keyword}”...`, 2000, 'neutral', false);
    const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}`;
    setTimeout(() => {
        shell.openExternal(searchUrl).catch(err => {
            console.error('打开浏览器失败:', err);
            showBubble('😵 打开浏览器失败，请检查网络设置', 3000);
        });
        if (previousState === 'idle' || previousState === 'working') {
            setTimeout(() => {
                if (state === 'working') setState('idle');
                startIdleTimer();
            }, 1500);
        } else {
            setTimeout(() => {
                if (state === 'working') setState(previousState);
            }, 1500);
        }
    }, 800);
    autoDiary('search', keyword);
}

// ==================== 记忆与学习 ====================
const LEARNING_FILE = path.join(os.homedir(), '.girlpet_learning.json');
const HISTORY_FILE = path.join(os.homedir(), '.girlpet_chat_history.json');

let learningData = {
    dialog: {},
    gomoku: { winning_moves: [], losing_moves: [], player_style: 'normal' },
    checkers: { winning_moves: [], losing_moves: [] },
    emotion: { stats: {}, taunt_frequency: 0.5, comfort_frequency: 0.3 }
};

let chatHistory = [];
const MAX_HISTORY_TURNS = 10;

function loadLearning() {
    try {
        if (fs.existsSync(LEARNING_FILE)) {
            const data = fs.readFileSync(LEARNING_FILE, 'utf8');
            const loaded = JSON.parse(data);
            Object.assign(learningData, loaded);
            if (!learningData.dialog) learningData.dialog = {};
            if (!learningData.gomoku) learningData.gomoku = { winning_moves: [], losing_moves: [], player_style: 'normal' };
            if (!learningData.checkers) learningData.checkers = { winning_moves: [], losing_moves: [] };
            if (!learningData.emotion) learningData.emotion = { stats: {}, taunt_frequency: 0.5, comfort_frequency: 0.3 };
            if (!learningData.emotion.stats) learningData.emotion.stats = {};
        }
    } catch(e) { console.error('加载学习数据失败', e); }
    
    const nameQuestion = normalizeQuestion('你叫什么名字');
    const nameQuestion2 = normalizeQuestion('你的名字');
    const nameQuestion3 = normalizeQuestion('你是谁');
    if (!learningData.dialog[nameQuestion]) {
        learningData.dialog[nameQuestion] = {
            count: 5,
            preferred_responses: ['我叫寻慧呀！是你给我起的名字～', '我是寻慧，你的桌面小精灵'],
            last_reply: '我叫寻慧呀！'
        };
    }
    if (!learningData.dialog[nameQuestion2]) {
        learningData.dialog[nameQuestion2] = learningData.dialog[nameQuestion];
    }
    if (!learningData.dialog[nameQuestion3]) {
        learningData.dialog[nameQuestion3] = {
            count: 5,
            preferred_responses: ['我是寻慧，一个会下棋、会学习的小女孩~', '我是寻慧呀，你的桌面伙伴'],
            last_reply: '我是寻慧'
        };
    }
    saveLearning();
}

function saveLearning() {
    try {
        fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningData, null, 2), 'utf8');
    } catch(e) { console.error('保存学习数据失败', e); }
}

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            chatHistory = JSON.parse(data);
            if (chatHistory.length > MAX_HISTORY_TURNS * 2)
                chatHistory = chatHistory.slice(-MAX_HISTORY_TURNS * 2);
        }
    } catch(e) { console.error('加载历史失败', e); }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2), 'utf8');
    } catch(e) { console.error('保存历史失败', e); }
}

function addToHistory(role, content) {
    chatHistory.push({ role, content });
    if (chatHistory.length > MAX_HISTORY_TURNS * 2)
        chatHistory = chatHistory.slice(-MAX_HISTORY_TURNS * 2);
    saveHistory();
}

function clearHistory() {
    chatHistory = [];
    saveHistory();
    showBubble('🧹 记忆已清空，我忘记了过去...', 2000);
}

function normalizeQuestion(text) {
    return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
}

function recordDialog(userMsg, assistantReply) {
    const normalized = normalizeQuestion(userMsg);
    if (!learningData.dialog[normalized]) {
        learningData.dialog[normalized] = {
            count: 0,
            preferred_responses: [],
            last_reply: ''
        };
    }
    const entry = learningData.dialog[normalized];
    entry.count++;
    if (!entry.preferred_responses.includes(assistantReply)) {
        entry.preferred_responses.unshift(assistantReply);
        if (entry.preferred_responses.length > 5) entry.preferred_responses.pop();
    }
    entry.last_reply = assistantReply;
    saveLearning();
}

function getCannedReply(userMsg) {
    const normalized = normalizeQuestion(userMsg);
    const entry = learningData.dialog[normalized];
    if (entry && entry.preferred_responses.length > 0) {
        return entry.preferred_responses[Math.floor(Math.random() * entry.preferred_responses.length)];
    }
    return null;
}

function updateEmotionPreference(emotion, positive) {
    if (!learningData.emotion.stats[emotion]) {
        learningData.emotion.stats[emotion] = { positive: 0, total: 0 };
    }
    const stat = learningData.emotion.stats[emotion];
    stat.total++;
    if (positive) stat.positive++;
    const likeRate = stat.positive / stat.total;
    if (emotion === 'taunt') learningData.emotion.taunt_frequency = Math.min(0.9, likeRate + 0.2);
    if (emotion === 'comfort') learningData.emotion.comfort_frequency = Math.min(0.9, likeRate + 0.2);
    saveLearning();
}

function onUserInteract() {
    if (currentEmotionType) {
        updateEmotionPreference(currentEmotionType, true);
        currentEmotionType = null;
        clearTimeout(emotionTimer);
    }
}

// ==================== 对话（Ollama + 系统身份 + 搜索/时间） ====================

async function talkToOllama(userMessage) {
    const searchMatch = userMessage.match(/^(搜索|查一下|百度|谷歌|搜一下|查找)[\s：:]*(.+)/i);
    if (searchMatch && searchMatch[2]) {
        const keyword = searchMatch[2].trim();
        await searchWeb(keyword);
        const reply = `🔍 已为你搜索“${keyword}”`;
        recordDialog(userMessage, reply);
        addToHistory('user', userMessage);
        addToHistory('assistant', reply);
        ipcRenderer.send('reply-to-mobile', reply);
        return;
    }
    
    const timeMatch = userMessage.match(/(几点了|现在时间|什么时间|几时了|现在几点)/i);
    if (timeMatch) {
        tellTime();
        const reply = `现在时间是 ${new Date().getHours()} 点 ${new Date().getMinutes()} 分`;
        recordDialog(userMessage, reply);
        addToHistory('user', userMessage);
        addToHistory('assistant', reply);
        ipcRenderer.send('reply-to-mobile', reply);
        return;
    }
    
    const canned = getCannedReply(userMessage);
    if (canned && Math.random() < 0.7) {
        showBubble(canned, 3000, 'neutral', false);
        recordDialog(userMessage, canned);
        if (canned.includes('工作')) goToWork();
        else if (canned.includes('睡觉')) goToBed();
        else if (canned.includes('玩')) play();
        else if (canned.includes('吃') || canned.includes('喂')) feed();
        addToHistory('user', userMessage);
        addToHistory('assistant', canned);
        ipcRenderer.send('reply-to-mobile', canned);
        autoDiary('talk', userMessage);
        // 手动播放语音，临时禁用随机玩耍
        if (randomPlayTimer) clearTimeout(randomPlayTimer);
        speak(canned, () => { startRandomPlay(); });
        return;
    }

    showBubble('🤔 思考中...', 1000, 'neutral', false);
    
    const systemMessage = {
        role: 'system',
        content: '你是一个可爱的桌面小女孩宠物，名字叫“寻慧”。你必须记住你的名字是“寻慧”。当用户问你“你叫什么名字”、“你是谁”时，你要回答“我叫寻慧呀”或“我是寻慧”。请用温柔可爱的语气回答，并且可以适当使用表情符号。'
    };
    const messages = [systemMessage, ...chatHistory, { role: 'user', content: userMessage }];
    
    try {
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2:7b',
                messages: messages,
                stream: false
            })
        });
        const data = await response.json();
        const reply = data.message.content;
        showBubble(reply, 5000, 'neutral', false);
        recordDialog(userMessage, reply);
        addToHistory('user', userMessage);
        addToHistory('assistant', reply);
        ipcRenderer.send('reply-to-mobile', reply);
        autoDiary('talk', userMessage);
        
        // 手动播放语音，临时禁用随机玩耍
        if (randomPlayTimer) clearTimeout(randomPlayTimer);
        speak(reply, () => { startRandomPlay(); });

        if (reply.includes('工作')) goToWork();
        else if (reply.includes('睡觉')) goToBed();
        else if (reply.includes('玩')) play();
        else if (reply.includes('吃') || reply.includes('喂')) feed();
    } catch (error) {
        const errorMsg = '😵 连接失败，请检查 Ollama 服务';
        showBubble(errorMsg, 3000, 'neutral', true);
        console.error(error);
    }
}

// ==================== 自定义输入框 ====================
let customInputDiv = null;

function createCustomInput() {
    if (customInputDiv) return;
    const div = document.createElement('div');
    div.id = 'customInput';
    div.style.position = 'fixed';
    div.style.backgroundColor = 'rgba(30,30,40,0.95)';
    div.style.border = '2px solid #ff99cc';
    div.style.borderRadius = '16px';
    div.style.padding = '10px 15px';
    div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    div.style.zIndex = '10000';
    div.style.display = 'none';
    div.style.fontFamily = 'system-ui, "Segoe UI", "Noto Sans CJK SC", sans-serif';
    div.innerHTML = `
        <div style="color: white; margin-bottom: 6px; font-size: 13px;">💬 对寻慧说：</div>
        <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="customInputText" placeholder="工作、睡觉、玩、几点了、搜索 天气..." style="flex: 1; padding: 6px 10px; border-radius: 20px; border: none; font-size: 14px; outline: none;">
            <button id="voiceInputBtn" style="background: #ff99cc; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; display: inline-flex; align-items: center; justify-content: center;">🎤</button>
        </div>
        <div style="margin-top: 8px; text-align: right;">
            <button id="customInputOk" style="background: #ff99cc; border: none; padding: 4px 14px; border-radius: 20px; margin-right: 6px; cursor: pointer; font-size: 12px;">发送</button>
            <button id="customInputCancel" style="background: #ccc; border: none; padding: 4px 14px; border-radius: 20px; cursor: pointer; font-size: 12px;">取消</button>
        </div>
    `;
    document.body.appendChild(div);
    customInputDiv = div;
    
    document.getElementById('customInputOk').onclick = () => {
        const msg = document.getElementById('customInputText').value.trim();
        div.style.display = 'none';
        if (msg) handleUserInput(msg);
    };
    document.getElementById('customInputCancel').onclick = () => {
        div.style.display = 'none';
        startIdleTimer();
    };
    const inputEl = document.getElementById('customInputText');
    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('customInputOk').click();
        }
    });
    
    // 绑定语音输入按钮
    const voiceBtn = document.getElementById('voiceInputBtn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', startVoiceInput);
    }
}

function showCustomInput() {
    createCustomInput();
    const girlRect = girl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const inputWidth = 260;
    const inputHeight = 100;
    
    let left = girlRect.right + 10;
    let top = girlRect.top;
    
    if (left + inputWidth > viewportWidth) {
        left = girlRect.left - inputWidth - 10;
    }
    if (top + inputHeight > viewportHeight) {
        top = viewportHeight - inputHeight - 10;
    }
    if (top < 10) top = 10;
    if (left < 10) left = 10;
    
    customInputDiv.style.left = left + 'px';
    customInputDiv.style.top = top + 'px';
    customInputDiv.style.display = 'block';
    const input = document.getElementById('customInputText');
    input.value = '';
    input.focus();
}

function handleUserInput(msg) {
    if (idleTimer) clearTimeout(idleTimer);
    if (state === 'sleeping') {
        setState('idle');
        showBubble('🌞 谁叫我？');
        startIdleTimer();
    }
    if (msg.includes('工作')) goToWork();
    else if (msg.includes('睡觉')) goToBed();
    else if (msg.includes('玩')) play();
    else if (msg.includes('喂食') || msg.includes('吃')) feed();
    else if (msg.includes('五子棋')) startGomoku();
    else if (msg.includes('跳棋')) startCheckers();
    else if (msg.includes('忘记')) clearHistory();
    else if (msg.includes('查看日记') || msg.includes('看日记')) handleViewDiary();
    
    else if (msg.includes('PPT') || msg.includes('幻灯片') || (msg.includes('写') && msg.includes('ppt'))) {
    let topic = msg.replace(/写|生成|帮我|一个|关于|的|PPT|幻灯片/g, '').trim();
    if (topic === '') topic = '未命名主题';
    generatePPT(topic);
}
    else talkToOllama(msg);
}

// ==================== 手机遥控 ====================
ipcRenderer.on('mobile-command', (event, data) => {
    const { action, text } = data;
    if (action === 'talk') talkToOllama(text);
    else if (action === 'feed') feed();
    else if (action === 'work') goToWork();
    else if (action === 'sleep') goToBed();
    else if (action === 'play') play();
    else if (action === 'gomoku') startGomoku();
    else if (action === 'checkers') startCheckers();
});

// ==================== 定时器 ====================
function startIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (state === 'idle') goToBed();
    }, 30 * 1000);
}

function startRandomPlay() {
    if (randomPlayTimer) clearTimeout(randomPlayTimer);
    randomPlayTimer = setTimeout(() => {
        // 只有空闲且没有正在说话时才能触发玩耍
        if (state === 'idle' && !isSpeaking) {
            play();
        }
        startRandomPlay();
    }, 10000 + Math.random() * 20000);
}

// ==================== 人物拖拽 ====================
let isDraggingGirl = false;
let dragStartX = 0, dragStartY = 0;
let girlStartLeft = 0, girlStartTop = 0;

girl.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isDraggingGirl = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    girlStartLeft = currentX;
    girlStartTop = currentY;
    girl.style.cursor = 'grabbing';
    e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
    if (!isDraggingGirl) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    let newLeft = girlStartLeft + dx;
    let newTop = girlStartTop + dy;
    const maxX = window.innerWidth - girl.offsetWidth;
    const maxY = window.innerHeight - girl.offsetHeight;
    newLeft = Math.min(Math.max(newLeft, 0), maxX);
    newTop = Math.min(Math.max(newTop, 0), maxY);
    currentX = newLeft;
    currentY = newTop;
    targetX = newLeft;
    targetY = newTop;
    updatePosition();
});

window.addEventListener('mouseup', () => {
    if (isDraggingGirl) {
        isDraggingGirl = false;
        girl.style.cursor = 'pointer';
    }
});

// ==================== 五子棋模块 ====================
let gomokuActive = false;
let boardSize = 15;
let cellSize = 20;
let board = [];
let gameOver = false;
let currentTurn = 'player';
let gomokuCanvas, gomokuCtx, gomokuPanel;

function initGomoku() {
    gomokuCanvas = document.getElementById('gomokuCanvas');
    gomokuCtx = gomokuCanvas.getContext('2d');
    gomokuPanel = document.getElementById('gomokuPanel');
    document.getElementById('closeGomokuBtn').onclick = () => {
        gomokuPanel.style.display = 'none';
        gomokuActive = false;
        setState('idle');
        showBubble('🎮 不玩啦？下次再来哦~', 2000);
    };
    document.getElementById('resetGomokuBtn').onclick = () => {
        resetGomokuGame();
        showBubble('🔄 新的一局！你先下吧', 1500);
    };
    gomokuCanvas.addEventListener('click', onGomokuClick);
    resetGomokuGame();

    const header = gomokuPanel.querySelector('.drag-header');
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = gomokuPanel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        gomokuPanel.style.position = 'fixed';
        gomokuPanel.style.margin = '0';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let left = e.clientX - dragOffsetX;
        let top = e.clientY - dragOffsetY;
        left = Math.min(Math.max(left, 0), window.innerWidth - gomokuPanel.offsetWidth);
        top = Math.min(Math.max(top, 0), window.innerHeight - gomokuPanel.offsetHeight);
        gomokuPanel.style.left = left + 'px';
        gomokuPanel.style.top = top + 'px';
        gomokuPanel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function resetGomokuGame() {
    board = Array(boardSize).fill().map(() => Array(boardSize).fill(0));
    gameOver = false;
    currentTurn = 'player';
    drawGomokuBoard();
}

function drawGomokuBoard() {
    gomokuCtx.clearRect(0, 0, 300, 300);
    gomokuCtx.strokeStyle = '#000';
    for (let i = 0; i < boardSize; i++) {
        gomokuCtx.beginPath();
        gomokuCtx.moveTo(i * cellSize, 0);
        gomokuCtx.lineTo(i * cellSize, 300);
        gomokuCtx.stroke();
        gomokuCtx.beginPath();
        gomokuCtx.moveTo(0, i * cellSize);
        gomokuCtx.lineTo(300, i * cellSize);
        gomokuCtx.stroke();
    }
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            if (board[i][j] === 1) {
                gomokuCtx.fillStyle = '#000';
                gomokuCtx.beginPath();
                gomokuCtx.arc(i * cellSize, j * cellSize, 8, 0, 2*Math.PI);
                gomokuCtx.fill();
            } else if (board[i][j] === 2) {
                gomokuCtx.fillStyle = '#fff';
                gomokuCtx.beginPath();
                gomokuCtx.arc(i * cellSize, j * cellSize, 8, 0, 2*Math.PI);
                gomokuCtx.fill();
                gomokuCtx.strokeStyle = '#000';
                gomokuCtx.stroke();
            }
        }
    }
}

function checkWin(x, y, playerVal) {
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for (let [dx, dy] of dirs) {
        let count = 1;
        for (let step = 1; step <= 4; step++) {
            const nx = x + dx*step, ny = y + dy*step;
            if (nx<0 || nx>=boardSize || ny<0 || ny>=boardSize) break;
            if (board[nx][ny] === playerVal) count++;
            else break;
        }
        for (let step = 1; step <= 4; step++) {
            const nx = x - dx*step, ny = y - dy*step;
            if (nx<0 || nx>=boardSize || ny<0 || ny>=boardSize) break;
            if (board[nx][ny] === playerVal) count++;
            else break;
        }
        if (count >= 5) return true;
    }
    return false;
}

function isFull() {
    for (let i=0; i<boardSize; i++)
        for (let j=0; j<boardSize; j++)
            if (board[i][j] === 0) return false;
    return true;
}

function evaluatePosition(x, y, playerVal) {
    let totalScore = 0;
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for (let [dx, dy] of dirs) {
        let count = 1;
        for (let step=1; step<=4; step++) {
            const nx = x + dx*step, ny = y + dy*step;
            if (nx<0 || nx>=boardSize || ny<0 || ny>=boardSize) break;
            if (board[nx][ny] === playerVal) count++;
            else break;
        }
        for (let step=1; step<=4; step++) {
            const nx = x - dx*step, ny = y - dy*step;
            if (nx<0 || nx>=boardSize || ny<0 || ny>=boardSize) break;
            if (board[nx][ny] === playerVal) count++;
            else break;
        }
        if (count >= 5) totalScore += 10000;
        else if (count === 4) totalScore += 1000;
        else if (count === 3) totalScore += 100;
        else if (count === 2) totalScore += 10;
    }
    const posKey = `${x},${y}`;
    if (playerVal === 2) {
        if (learningData.gomoku.winning_moves.includes(posKey)) totalScore += 500;
        if (learningData.gomoku.losing_moves.includes(posKey)) totalScore -= 300;
    }
    return totalScore;
}

function recordGomokuResult(winner, lastMove) {
    if (winner === 'ai') {
        learningData.gomoku.winning_moves.push(`${lastMove.x},${lastMove.y}`);
        if (learningData.gomoku.winning_moves.length > 20) learningData.gomoku.winning_moves.shift();
    } else if (winner === 'player') {
        learningData.gomoku.losing_moves.push(`${lastMove.x},${lastMove.y}`);
        if (learningData.gomoku.losing_moves.length > 20) learningData.gomoku.losing_moves.shift();
    }
    saveLearning();
}

function aiGomokuMove() {
    if (!gomokuActive || gameOver || currentTurn !== 'ai') return;
    let bestScore = -1;
    let bestMove = null;
    for (let i=0; i<boardSize; i++) {
        for (let j=0; j<boardSize; j++) {
            if (board[i][j] === 0) {
                let score = evaluatePosition(i, j, 2);
                let defendScore = evaluatePosition(i, j, 1);
                let total = score + defendScore * 0.8;
                if (total > bestScore) {
                    bestScore = total;
                    bestMove = [i, j];
                }
            }
        }
    }
    if (bestMove) {
        const [x, y] = bestMove;
        board[x][y] = 2;
        drawGomokuBoard();
        if (checkWin(x, y, 2)) {
            gameOver = true;
            showBubble('😎 哈哈，我赢啦！你还要加油哦~', 3000, 'taunt');
            recordGomokuResult('ai', {x, y});
            return;
        }
        if (isFull()) {
            gameOver = true;
            showBubble('🤝 平局！', 2000);
            return;
        }
        currentTurn = 'player';
        if (Math.random() < 0.3) showBubble('该你了', 1000);
    }
}

function onGomokuClick(e) {
    if (!gomokuActive || gameOver || currentTurn !== 'player') return;
    const rect = gomokuCanvas.getBoundingClientRect();
    const scaleX = gomokuCanvas.width / rect.width;
    const scaleY = gomokuCanvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    const x = Math.round(mouseX / cellSize);
    const y = Math.round(mouseY / cellSize);
    if (x<0 || x>=boardSize || y<0 || y>=boardSize) return;
    if (board[x][y] !== 0) return;

    board[x][y] = 1;
    drawGomokuBoard();
    if (checkWin(x, y, 1)) {
        gameOver = true;
        showBubble('🎉 哇！你赢啦！我认输~', 3000, 'comfort');
        recordGomokuResult('player', {x, y});
        return;
    }
    if (isFull()) {
        gameOver = true;
        showBubble('🤝 平局！', 2000);
        return;
    }
    currentTurn = 'ai';
    setTimeout(() => aiGomokuMove(), 300);
    autoDiary('gomoku');
}

function startGomoku() {
    if (gomokuActive) {
        gomokuPanel.style.display = 'none';
        gomokuActive = false;
        setState('idle');
        return;
    }
    const cp = document.getElementById('checkersPanel');
    if (cp.style.display === 'block') cp.style.display = 'none';
    checkersActive = false;
    gomokuPanel.style.display = 'block';
    gomokuActive = true;
    resetGomokuGame();
    setState('idle');
    showBubble('🎲 来下五子棋吧！你先下~', 2000);
}

// ==================== 跳棋模块（360x360） ====================
let checkersActive = false;
const CHECKERS_SIZE = 8;
let checkersBoardData = [];
let checkersCurrentTurn = 'player';
let checkersGameOver = false;
let checkersSelectedRow = -1, checkersSelectedCol = -1;
let checkersCanvas, checkersCtx, checkersPanel;

function initCheckers() {
    checkersCanvas = document.getElementById('checkersCanvas');
    checkersCtx = checkersCanvas.getContext('2d');
    checkersPanel = document.getElementById('checkersPanel');
    document.getElementById('closeCheckersBtn').onclick = () => {
        checkersPanel.style.display = 'none';
        checkersActive = false;
        setState('idle');
        showBubble('👋 跳棋结束，下次再玩~', 2000);
    };
    document.getElementById('resetCheckersBtn').onclick = () => {
        resetCheckersGame();
        showBubble('🔄 新的一局！你先走~', 1500);
    };
    checkersCanvas.addEventListener('click', onCheckersClick);
    resetCheckersGame();

    const header = checkersPanel.querySelector('.drag-header');
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = checkersPanel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        checkersPanel.style.position = 'fixed';
        checkersPanel.style.margin = '0';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let left = e.clientX - dragOffsetX;
        let top = e.clientY - dragOffsetY;
        left = Math.min(Math.max(left, 0), window.innerWidth - checkersPanel.offsetWidth);
        top = Math.min(Math.max(top, 0), window.innerHeight - checkersPanel.offsetHeight);
        checkersPanel.style.left = left + 'px';
        checkersPanel.style.top = top + 'px';
        checkersPanel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function resetCheckersGame() {
    checkersBoardData = Array(CHECKERS_SIZE).fill().map(() => Array(CHECKERS_SIZE).fill(0));
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < CHECKERS_SIZE; col++) {
            if ((row + col) % 2 === 1) checkersBoardData[row][col] = 1;
        }
    }
    for (let row = CHECKERS_SIZE-3; row < CHECKERS_SIZE; row++) {
        for (let col = 0; col < CHECKERS_SIZE; col++) {
            if ((row + col) % 2 === 1) checkersBoardData[row][col] = 2;
        }
    }
    checkersCurrentTurn = 'player';
    checkersGameOver = false;
    checkersSelectedRow = -1;
    drawCheckersBoard();
}

function drawCheckersBoard() {
    const size = 360 / CHECKERS_SIZE;
    checkersCtx.clearRect(0, 0, 360, 360);
    for (let row = 0; row < CHECKERS_SIZE; row++) {
        for (let col = 0; col < CHECKERS_SIZE; col++) {
            const x = col * size;
            const y = row * size;
            if ((row + col) % 2 === 0) checkersCtx.fillStyle = '#F0D9B5';
            else checkersCtx.fillStyle = '#B58863';
            checkersCtx.fillRect(x, y, size, size);
            const val = checkersBoardData[row][col];
            if (val !== 0) {
                const cx = x + size/2;
                const cy = y + size/2;
                const r = size * 0.4;
                checkersCtx.beginPath();
                checkersCtx.arc(cx, cy, r, 0, 2*Math.PI);
                checkersCtx.fillStyle = val === 1 ? '#333' : '#FFF';
                checkersCtx.fill();
                checkersCtx.strokeStyle = '#000';
                checkersCtx.stroke();
                if (checkersSelectedRow === row && checkersSelectedCol === col) {
                    checkersCtx.strokeStyle = 'red';
                    checkersCtx.lineWidth = 3;
                    checkersCtx.beginPath();
                    checkersCtx.arc(cx, cy, r+2, 0, 2*Math.PI);
                    checkersCtx.stroke();
                    checkersCtx.lineWidth = 1;
                }
            }
        }
    }
}

function isValidMove(row, col, newRow, newCol, playerVal) {
    if (newRow<0 || newRow>=CHECKERS_SIZE || newCol<0 || newCol>=CHECKERS_SIZE) return false;
    if (checkersBoardData[newRow][newCol] !== 0) return false;
    const rowDiff = newRow - row;
    const colDiff = Math.abs(newCol - col);
    if (colDiff !== 1) return false;
    if (playerVal === 1 && rowDiff !== 1) return false;
    if (playerVal === 2 && rowDiff !== -1) return false;
    return true;
}

function isValidJump(row, col, newRow, newCol, playerVal) {
    const midRow = (row + newRow) / 2;
    const midCol = (col + newCol) / 2;
    if (midRow % 1 !== 0 || midCol % 1 !== 0) return false;
    const rowDiff = newRow - row;
    const colDiff = Math.abs(newCol - col);
    if (Math.abs(rowDiff) !== 2 || colDiff !== 2) return false;
    const midVal = checkersBoardData[midRow][midCol];
    if (midVal === 0 || midVal === playerVal) return false;
    if (checkersBoardData[newRow][newCol] !== 0) return false;
    if (playerVal === 1 && rowDiff < 0) return false;
    if (playerVal === 2 && rowDiff > 0) return false;
    return true;
}

function getAllValidMoves(playerVal) {
    let moves = [];
    for (let row=0; row<CHECKERS_SIZE; row++) {
        for (let col=0; col<CHECKERS_SIZE; col++) {
            if (checkersBoardData[row][col] === playerVal) {
                for (let dr of [-2,2]) {
                    for (let dc of [-2,2]) {
                        const nr = row + dr;
                        const nc = col + dc;
                        if (isValidJump(row, col, nr, nc, playerVal)) {
                            moves.push({row, col, newRow: nr, newCol: nc, isJump: true});
                        }
                    }
                }
                if (moves.length === 0) {
                    const dr = (playerVal === 1) ? 1 : -1;
                    for (let dc of [-1,1]) {
                        const nr = row + dr;
                        const nc = col + dc;
                        if (isValidMove(row, col, nr, nc, playerVal)) {
                            moves.push({row, col, newRow: nr, newCol: nc, isJump: false});
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function applyCheckersMove(move) {
    const {row, col, newRow, newCol, isJump} = move;
    const playerVal = checkersBoardData[row][col];
    checkersBoardData[newRow][newCol] = playerVal;
    checkersBoardData[row][col] = 0;
    if (isJump) {
        const midRow = (row + newRow)/2;
        const midCol = (col + newCol)/2;
        checkersBoardData[midRow][midCol] = 0;
        if (playerVal === 2) showBubble('😏 哈哈，吃掉你的棋子！', 1500, 'taunt');
        else showBubble('🎯 好耶！我也能吃子~', 1500);
    }
    drawCheckersBoard();
}

function checkCheckersWin() {
    let hasPlayer = false, hasAI = false;
    for (let row=0; row<CHECKERS_SIZE; row++) {
        for (let col=0; col<CHECKERS_SIZE; col++) {
            if (checkersBoardData[row][col] === 1) hasPlayer = true;
            if (checkersBoardData[row][col] === 2) hasAI = true;
        }
    }
    if (!hasPlayer) return 'ai';
    if (!hasAI) return 'player';
    return null;
}

function recordCheckersResult(winner, lastMoveKey) {
    if (winner === 'ai') {
        learningData.checkers.winning_moves.push(lastMoveKey);
        if (learningData.checkers.winning_moves.length > 30) learningData.checkers.winning_moves.shift();
    } else if (winner === 'player') {
        learningData.checkers.losing_moves.push(lastMoveKey);
        if (learningData.checkers.losing_moves.length > 30) learningData.checkers.losing_moves.shift();
    }
    saveLearning();
}

function aiCheckersMove() {
    if (!checkersActive || checkersGameOver || checkersCurrentTurn !== 'ai') return;
    let moves = getAllValidMoves(2);
    if (moves.length === 0) {
        checkersGameOver = true;
        showBubble('😖 我没路可走了，你赢啦！', 3000, 'comfort');
        recordCheckersResult('player', 'none');
        return;
    }
    let scoredMoves = moves.map(move => {
        let score = Math.random();
        const moveKey = `${move.row},${move.col}->${move.newRow},${move.newCol}`;
        if (learningData.checkers.winning_moves.includes(moveKey)) score += 0.8;
        if (learningData.checkers.losing_moves.includes(moveKey)) score -= 0.5;
        return { move, score };
    });
    scoredMoves.sort((a,b) => b.score - a.score);
    const best = scoredMoves[0].move;
    applyCheckersMove(best);
    const winner = checkCheckersWin();
    if (winner) {
        checkersGameOver = true;
        if (winner === 'ai') {
            showBubble('🎉 我赢啦！不过你下得也不错~', 3000, 'taunt');
            recordCheckersResult('ai', `${best.row},${best.col}->${best.newRow},${best.newCol}`);
        } else {
            showBubble('🏆 你赢了！好厉害', 3000, 'comfort');
            recordCheckersResult('player', `${best.row},${best.col}->${best.newRow},${best.newCol}`);
        }
        return;
    }
    checkersCurrentTurn = 'player';
    if (Math.random() < learningData.emotion.taunt_frequency) {
        const taunts = ['轮到你了', '看你怎么走', '我要小心了', '😼'];
        showBubble(taunts[Math.floor(Math.random()*taunts.length)], 1500, 'taunt');
    }
}

function onCheckersClick(e) {
    if (!checkersActive || checkersGameOver || checkersCurrentTurn !== 'player') return;
    const rect = checkersCanvas.getBoundingClientRect();
    const scale = checkersCanvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scale;
    const mouseY = (e.clientY - rect.top) * scale;
    const cellSize = 360 / CHECKERS_SIZE;
    const col = Math.floor(mouseX / cellSize);
    const row = Math.floor(mouseY / cellSize);
    if (row<0 || row>=CHECKERS_SIZE || col<0 || col>=CHECKERS_SIZE) return;

    if (checkersSelectedRow === -1) {
        if (checkersBoardData[row][col] === 1) {
            checkersSelectedRow = row;
            checkersSelectedCol = col;
            drawCheckersBoard();
        }
    } else {
        const fromRow = checkersSelectedRow, fromCol = checkersSelectedCol;
        let valid = false;
        let move = null;
        if (isValidJump(fromRow, fromCol, row, col, 1)) {
            valid = true;
            move = {row:fromRow, col:fromCol, newRow:row, newCol:col, isJump:true};
        } else if (isValidMove(fromRow, fromCol, row, col, 1)) {
            valid = true;
            move = {row:fromRow, col:fromCol, newRow:row, newCol:col, isJump:false};
        }
        if (valid) {
            applyCheckersMove(move);
            checkersSelectedRow = -1;
            const winner = checkCheckersWin();
            if (winner) {
                checkersGameOver = true;
                if (winner === 'player') {
                    showBubble('🏆 你赢啦！我输得心服口服~', 3000, 'comfort');
                    recordCheckersResult('player', `${move.row},${move.col}->${move.newRow},${move.newCol}`);
                } else {
                    showBubble('🎉 哈哈，我赢啦！别灰心，再来一局？', 3000, 'taunt');
                    recordCheckersResult('ai', `${move.row},${move.col}->${move.newRow},${move.newCol}`);
                }
                return;
            }
            checkersCurrentTurn = 'ai';
            setTimeout(() => aiCheckersMove(), 500);
        } else {
            checkersSelectedRow = -1;
            drawCheckersBoard();
            showBubble('❌ 不能这样走哦', 1000);
        }
    }
    autoDiary('checkers');
}

function startCheckers() {
    if (checkersActive) {
        checkersPanel.style.display = 'none';
        checkersActive = false;
        setState('idle');
        return;
    }
    const gp = document.getElementById('gomokuPanel');
    if (gp.style.display === 'block') gp.style.display = 'none';
    gomokuActive = false;
    checkersPanel.style.display = 'block';
    checkersActive = true;
    resetCheckersGame();
    setState('idle');
    showBubble('🎲 来下跳棋吧！你先走~', 2000);
}

// ==================== 初始化 ====================
loadLearning();
loadHistory();
initGomoku();
initCheckers();
startAutoSleepCheck();

girl.addEventListener('click', () => {
    console.log('点击了寻慧');
    onUserInteract();
    if (idleTimer) clearTimeout(idleTimer);
    if (state === 'sleeping') {
        setState('idle');
        showBubble('🌞 谁叫我？');
        startIdleTimer();
    }
    showCustomInput();
});

// ==================== 语音输入功能 ====================

// ==================== 语音输入（优化版：快速识别 + 超时控制） ====================
let currentRecognition = null;
let isVoiceListening = false;
let recognitionTimeout = null;

function startVoiceInput() {
    if (isVoiceListening) {
        showBubble('正在听呢，请稍等...', 1000);
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showBubble('浏览器不支持语音识别', 2000);
        return;
    }
    if (!currentRecognition) {
        currentRecognition = new SpeechRecognition();
        currentRecognition.lang = 'zh-CN';
        currentRecognition.continuous = false;
        currentRecognition.interimResults = false;
        currentRecognition.maxAlternatives = 1;
        
        currentRecognition.onstart = () => {
            isVoiceListening = true;
            showBubble('🎙️ 请说话...', 2000, 'neutral', false);
            const btn = document.getElementById('voiceInputBtn');
            if (btn) btn.style.background = '#ff6666';
            // 设置超时（5秒无语音自动停止）
            recognitionTimeout = setTimeout(() => {
                if (isVoiceListening) {
                    currentRecognition.stop();
                    showBubble('⏰ 没有检测到语音，请重试', 2000);
                }
            }, 5000);
        };
        
        currentRecognition.onend = () => {
            isVoiceListening = false;
            if (recognitionTimeout) clearTimeout(recognitionTimeout);
            const btn = document.getElementById('voiceInputBtn');
            if (btn) btn.style.background = '#ff99cc';
        };
        
        currentRecognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            console.log('识别结果:', text);
            if (recognitionTimeout) clearTimeout(recognitionTimeout);
            const inputEl = document.getElementById('customInputText');
            if (inputEl) {
                inputEl.value = text;
                // 自动发送
                document.getElementById('customInputOk').click();
            }
        };
        
        currentRecognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            if (recognitionTimeout) clearTimeout(recognitionTimeout);
            let msg = '识别失败';
            if (event.error === 'not-allowed') msg = '请允许麦克风权限';
            else if (event.error === 'no-speech') msg = '没有检测到声音，请调大音量或靠近麦克风';
            else if (event.error === 'audio-capture') msg = '麦克风不可用，请检查设备';
            else if (event.error === 'network') msg = '网络问题，请稍后重试';
            showBubble(`😵 ${msg}`, 3000);
            isVoiceListening = false;
            const btn = document.getElementById('voiceInputBtn');
            if (btn) btn.style.background = '#ff99cc';
        };
    }
    try {
        currentRecognition.start();
    } catch (e) {
        console.error(e);
        showBubble('启动失败，请刷新页面重试', 2000);
    }
}

// ==================== 拖拽喂食功能 ====================
let hungerTimer = null;
let foodIcon = null;

// 显示食物图标（出现在小女孩附近随机偏移）
function showFoodIcon() {
    if (!foodIcon) {
        foodIcon = document.getElementById('foodIcon');
        if (!foodIcon) return;
    }
    // 随机食物种类
    const foods = ['🍎', '🍰', '🍪', '🍔', '🍕', '🍩'];
    const randomFood = foods[Math.floor(Math.random() * foods.length)];
    foodIcon.innerText = randomFood;
    
    // 获取小女孩位置
    const girlRect = girl.getBoundingClientRect();
    let left = girlRect.left + 40 + (Math.random() * 60 - 30);
    let top = girlRect.top - 40 + (Math.random() * 40);
    // 边界限制
    left = Math.min(Math.max(left, 10), window.innerWidth - 60);
    top = Math.min(Math.max(top, 10), window.innerHeight - 60);
    foodIcon.style.left = left + 'px';
    foodIcon.style.top = top + 'px';
    foodIcon.style.display = 'flex';
    
    // 5秒后如果还没有被拖拽，自动消失并再次提醒
    setTimeout(() => {
        if (foodIcon.style.display === 'flex') {
            foodIcon.style.display = 'none';
            showBubble('😢 再不喂我，食物要消失啦～', 2000);
            // 过一会儿再重新索要
            setTimeout(() => startHungerTimer(), 5000);
        }
    }, 8000);
}

// 隐藏食物图标
function hideFoodIcon() {
    if (foodIcon) foodIcon.style.display = 'none';
}

// 处理喂食（由拖拽触发）
function onFeedByDrag() {
    hideFoodIcon();
    feed();  // 复用原有的 feed 函数
    // 清除饥饿定时器，重新开始计时
    if (hungerTimer) clearTimeout(hungerTimer);
    startHungerTimer();
}

// 主动索要食物（随机间隔）
function startHungerTimer() {
    if (hungerTimer) clearTimeout(hungerTimer);
    const delay = 30000 + Math.random() * 60000; // 30~90秒
    hungerTimer = setTimeout(() => {
        if (state !== 'sleeping' && !isSpeaking) {
            showBubble('🍽️ 我有点饿了～', 3000);
            showFoodIcon();
        } else {
            // 如果正在睡觉或说话，延迟再试
            startHungerTimer();
        }
    }, delay);
}

// 设置拖拽事件
function initDragDrop() {
    foodIcon = document.getElementById('foodIcon');
    if (!foodIcon) return;
    
    // 设置小女孩为可接收拖拽
    girl.setAttribute('dropzone', 'move');
    girl.addEventListener('dragover', (e) => {
        e.preventDefault(); // 必须，允许放置
    });
    
    girl.addEventListener('drop', (e) => {
        e.preventDefault();
        // 检查拖拽源是否是食物图标
        if (e.dataTransfer.getData('text/plain') === 'food') {
            onFeedByDrag();
        }
    });
    
    foodIcon.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'food');
        e.dataTransfer.effectAllowed = 'copy';
        foodIcon.style.opacity = '0.6';
    });
    foodIcon.addEventListener('dragend', () => {
        foodIcon.style.opacity = '1';
    });
}

// 页面加载完成后初始化拖拽
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragDrop);
} else {
    initDragDrop();
}

// 启动主动索要定时器（在应用启动后调用）
startHungerTimer();

setState('idle');
updatePosition();
startIdleTimer();
startRandomPlay();
showBubble('🐣 寻慧上线啦！点击我聊天～', 3000);