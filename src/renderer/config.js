// ==================== 配置常量 ====================
// 图像映射
const imgMap = {
    idle: 'images/idle.gif',
    idle2: 'images/idle2.gif',
    walking: 'images/walk.gif',
    working: 'images/work.gif',
    sleeping: 'images/sleep.gif',
    playing: 'images/play.gif',
    playing2: 'images/play2.gif',
    eating: 'images/eat.gif',
    waking: 'images/wake.gif',
    stretching: 'images/stretch.gif',
    dancing: 'images/dance.gif',
    disgust: 'images/disgust.gif',
    think: 'images/think.gif'
};

// 文件路径配置
const FILE_PATHS = {
    diary: '.girlpet_diary.txt',
    learning: '.girlpet_learning.json',
    history: '.girlpet_chat_history.json',
    lyrics: '.girlpet_lyrics.json'
};

// 状态配置
const STATE_CONFIG = {
    minDuration: 600000,           // 状态最少保持 10 分钟
    idleTimeout: 600000,             // 空闲超时 10 分钟
    randomPlayMin: 10000,          // 随机玩耍最小间隔
    randomPlayMax: 30000,          // 随机玩耍最大间隔
    hungerMin: 30000,              // 饥饿最小间隔
    hungerMax: 90000               // 饥饿最大间隔
};

// 睡眠时间配置
const SLEEP_CONFIG = {
    sleepTime: { hour: 22, minute: 0 },
    wakeTime: { hour: 7, minute: 0 },
    checkInterval: 60000 ,          // 检查间隔 1 分钟
    wakeAnimDuration: 4000,      // 苏醒动画时长（毫秒），可自行修改
    stretchAnimDuration: 2000    // 伸懒腰动画时长（可选）
};

// 游戏反应配置
const GAME_REACTIONS = {
    player: [
        '🎉 哇！你赢啦！好厉害！',
        '😊 你赢了！我认输～',
        '🏆 恭喜你！再来一局吗？',
        '✨ 你太强了！我服啦！'
    ],
    ai: [
        '😎 哈哈，我赢啦！',
        '🎲 承让承让～',
        '😏 再来一局吧？',
        '🤭 这次我运气好而已！'
    ],
    draw: '🤝 平局！势均力敌呀～'
};

// 玩耍动作配置
const PLAY_ACTIONS = [
    { text: '♪ 哼哼～ ♪', sound: '哼哼哼～' },
    { text: '😄 哈哈哈', sound: '哈哈哈' },
    { text: '🎵 啦啦啦～', sound: '啦啦啦～' },
    { text: '😊 嘻嘻', sound: '嘻嘻' },
    { text: '🎶 哒哒哒～', sound: '哒哒哒～' }
];

// 日记动作映射
const DIARY_ACTIONS = {
    feed: (name) => `${name} 喂我吃东西，好开心～`,
    work: (name) => `${name} 让我去工作，我努力完成了任务！`,
    play: (name) => `${name} 陪我玩耍，今天超有趣！`,
    sleep: (name) => `到点睡觉啦，${name} 晚安～`,
    talk: (name, detail) => `和 ${name} 聊天：${detail}`,
    wake: () => `醒来啦，新的一天！`,
    search: (name, detail) => `${name} 让我搜索"${detail}"`,
    gomoku: (name) => `和 ${name} 下五子棋`,
    checkers: (name) => `和 ${name} 下跳棋`,
    default: (name) => `${name} 和我互动了～`
};

// 食物图标
const FOOD_ICONS = ['🍎', '🍰', '🍪', '🍔', '🍕', '🍩'];

// 情绪反应
const EMOTION_REACTIONS = {
    diary: [
        '😳 哎呀，被你发现我的小秘密了...',
        '😊 你居然偷偷看我的日记！不过...很开心～',
        '😏 哼！看就看吧，反正写的都是你～',
        '🤗 以后我们可以一起写日记哦！',
        '😜 下次要提前告诉我，我打扮一下日记本～'
    ]
};

// 位置配置
const POSITION_CONFIG = {
    baseWorkPos: { x: 300, y: 300 },
    baseBedPos: { x: 200, y: 400 }
};

// ==================== 节日祝福配置 ====================
const FESTIVALS = [
    { month: 1, day: 1, name: '元旦', greetings: ['新年快乐！新的一年也要一起加油哦~', '元旦快乐！今天适合许愿！'] },
    { month: 2, day: 14, name: '情人节', greetings: ['情人节快乐！要一直甜甜蜜蜜的呀~', '今天是情人节，送你一颗虚拟巧克力 🍫'] },
    { month: 3, day: 8, name: '妇女节', greetings: ['女神节快乐！今天你是最美的~'] },
    { month: 4, day: 1, name: '愚人节', greetings: ['愚人节快乐！今天我说的话可别全信哦~'] },
    { month: 5, day: 1, name: '劳动节', greetings: ['劳动节快乐！辛苦啦，好好休息一下吧~'] },
    { month: 6, day: 1, name: '儿童节', greetings: ['儿童节快乐！谁还不是个宝宝呢~'] },
    { month: 10, day: 1, name: '国庆节', greetings: ['国庆快乐！假期愉快~'] },
    { month: 12, day: 25, name: '圣诞节', greetings: ['圣诞快乐！今晚会有礼物吗？🎄'] }
];

// ==================== 农历春节公历日期表（除夕 = 春节前一天） ====================
// 格式：年份 -> [月份, 日期]，例如 '2026': [2, 17] 表示2026年春节是2月17日
const LUNAR_NEW_YEAR_DATES = {
    '2026': [2, 17],
    '2027': [2,  6],
    '2028': [1, 26],
    '2029': [2, 13],
    '2030': [2,  3]
};

// 导出配置
window.CONFIG = {
    imgMap,
    FILE_PATHS,
    STATE_CONFIG,
    SLEEP_CONFIG,
    GAME_REACTIONS,
    PLAY_ACTIONS,
    DIARY_ACTIONS,
    FOOD_ICONS,
    EMOTION_REACTIONS,
    FESTIVALS,            
    LUNAR_NEW_YEAR_DATES,
    ...POSITION_CONFIG
};