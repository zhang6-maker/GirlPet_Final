// ==================== 本地存储模块 ====================
// 依赖: window.CONFIG, window.DEPENDENCIES

// 获取文件完整路径
function getFilePath(filename) {
    return window.DEPENDENCIES.path.join(window.DEPENDENCIES.os.homedir(), filename);
}

// ==================== 日记功能 ====================
function writeDiary(content) {
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
    const entry = `[${timestamp}] ${content}\n`;
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.diary);
    try {
        window.DEPENDENCIES.fs.appendFileSync(filePath, entry, 'utf8');
        console.log('日记记录:', entry);
    } catch (err) {
        console.error('写入日记失败:', err);
    }
}

function readDiary() {
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.diary);
    try {
        if (window.DEPENDENCIES.fs.existsSync(filePath)) {
            return window.DEPENDENCIES.fs.readFileSync(filePath, 'utf8');
        } else {
            return '还没有日记记录呢～';
        }
    } catch (err) {
        console.error('读取日记失败:', err);
        return '日记读取失败';
    }
}

function autoDiary(action, detail = '') {
    const userName = '姐姐';
    const diaryActions = window.CONFIG.DIARY_ACTIONS;
    let content = '';
    
    if (diaryActions[action]) {
        content = diaryActions[action](userName, detail);
    } else {
        content = diaryActions.default(userName);
    }
    writeDiary(content);
}

// ==================== 歌词功能 ====================
function loadLyrics() {
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.lyrics);
    try {
        if (window.DEPENDENCIES.fs.existsSync(filePath)) {
            return JSON.parse(window.DEPENDENCIES.fs.readFileSync(filePath, 'utf8'));
        }
    } catch(e) { 
        console.error('加载歌词库失败', e); 
    }
    return {};
}

function saveLyrics(lyricsDB) {
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.lyrics);
    try {
        window.DEPENDENCIES.fs.writeFileSync(filePath, JSON.stringify(lyricsDB, null, 2), 'utf8');
    } catch(e) { 
        console.error('保存歌词失败', e); 
    }
}

// ==================== 学习功能 ====================
let learningData = {
    dialog: {},
    gomoku: { winning_moves: [], losing_moves: [], player_style: 'normal' },
    checkers: { winning_moves: [], losing_moves: [] },
    emotion: { stats: {}, taunt_frequency: 0.5, comfort_frequency: 0.3 },
    userProfile: {                  //  用户画像
        gender: '',                 // 'male' 或 'female'
        hasLover: false,
        loverGender: '',
        birthday: ''                //  新增生日字段，格式 'MM-DD'
    },

    affection: {
        value: 50,          // 初始好感度
        lastChange: 0,      // 上次变化时间戳(毫秒)
        cooldown: 60000     // 冷却1分钟
    }
};

function loadLearning() {
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.learning);
    try {
        if (window.DEPENDENCIES.fs.existsSync(filePath)) {
            const data = window.DEPENDENCIES.fs.readFileSync(filePath, 'utf8');
            Object.assign(learningData, JSON.parse(data));
        }
    } catch(e) { 
        console.error('加载学习数据失败', e); 
    }
    
    const nameQuestion = normalizeQuestion('你叫什么名字');
    if (!learningData.dialog[nameQuestion]) {
        learningData.dialog[nameQuestion] = {
            count: 5,
            preferred_responses: ['我叫寻慧呀！是你给我起的名字～', '我是寻慧，你的桌面小精灵'],
            last_reply: '我叫寻慧呀！'
        };
    }
    saveLearning();
}

function saveLearning() {
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.learning);
    try {
        window.DEPENDENCIES.fs.writeFileSync(filePath, JSON.stringify(learningData, null, 2), 'utf8');
    } catch(e) { 
        console.error('保存学习数据失败', e); 
    }
}

function normalizeQuestion(text) {
    return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '');
}

function recordDialog(userMsg, assistantReply) {
    const normalized = normalizeQuestion(userMsg);
    if (!learningData.dialog[normalized]) {
        learningData.dialog[normalized] = { count: 0, preferred_responses: [], last_reply: '' };
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

// ==================== 历史记录 ====================
let chatHistory = [];
const MAX_HISTORY_TURNS = 10;

function loadHistory() {
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.history);
    try {
        if (window.DEPENDENCIES.fs.existsSync(filePath)) {
            chatHistory = JSON.parse(window.DEPENDENCIES.fs.readFileSync(filePath, 'utf8'));
            if (chatHistory.length > MAX_HISTORY_TURNS * 2)
                chatHistory = chatHistory.slice(-MAX_HISTORY_TURNS * 2);
        }
    } catch(e) { 
        console.error('加载历史失败', e); 
    }
}

function saveHistory() {
    const filePath = getFilePath(window.CONFIG.FILE_PATHS.history);
    try {
        window.DEPENDENCIES.fs.writeFileSync(filePath, JSON.stringify(chatHistory, null, 2), 'utf8');
    } catch(e) { 
        console.error('保存历史失败', e); 
    }
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
}

// 导出存储模块
window.STORAGE = {
    // 日记
    writeDiary,
    readDiary,
    autoDiary,
    // 歌词
    loadLyrics,
    saveLyrics,
    // 学习
    loadLearning,
    saveLearning,
    recordDialog,
    getCannedReply,
    updateEmotionPreference,
    // 历史
    loadHistory,
    saveHistory,
    addToHistory,
    clearHistory,
    // 数据访问
    getLearningData: () => learningData,
    getChatHistory: () => chatHistory,

        // 节日祝福状态管理
    getFestivalLastDate: function() {
        const filePath = getFilePath('.girlpet_festival.txt');
        try {
            if (window.DEPENDENCIES.fs.existsSync(filePath)) {
                return window.DEPENDENCIES.fs.readFileSync(filePath, 'utf8').trim();
            }
        } catch(e) { console.error('读取节日状态失败', e); }
        return '';
    },
    setFestivalLastDate: function(dateStr) {
        const filePath = getFilePath('.girlpet_festival.txt');
        try {
            window.DEPENDENCIES.fs.writeFileSync(filePath, dateStr, 'utf8');
        } catch(e) { console.error('保存节日状态失败', e); }
    },

    getLastBootDate: function() {
        const filePath = getFilePath('.girlpet_lastboot.txt');
        try {
            if (window.DEPENDENCIES.fs.existsSync(filePath)) {
                return window.DEPENDENCIES.fs.readFileSync(filePath, 'utf8').trim();
            }
        } catch(e) { console.error('读取最后重启日期失败', e); }
        return '';
    },
    setLastBootDate: function(dateStr) {
        const filePath = getFilePath('.girlpet_lastboot.txt');
        try {
            window.DEPENDENCIES.fs.writeFileSync(filePath, dateStr, 'utf8');
        } catch(e) { console.error('保存最后重启日期失败', e); }
    }
};