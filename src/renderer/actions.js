// ==================== 动作模块 ====================
// 依赖: window.CONFIG, window.STATE, window.UI, window.TTS, window.STORAGE, window.DEPENDENCIES

// ==================== 工作 ====================
function goToWork() {
    const s = window.STATE;
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;
    if (s.state === 'walking' || s.state === 'working' || s.state === 'sleeping') return;
    if (s.state === 'waking') {
        setTimeout(goToWork, 500);
        return;
    }

    const maxX = window.innerWidth - girl.offsetWidth;
    const maxY = window.innerHeight - girl.offsetHeight;
    const targetPos = { x: Math.min(window.CONFIG.baseWorkPos.x, maxX), y: Math.min(window.CONFIG.baseWorkPos.y, maxY) };

    s.setState('walking');
    s.targetX = targetPos.x;
    s.targetY = targetPos.y;
    s.workPos = targetPos;
    s.moveStep();
    window.UI.showBubble('💼 去工作...', 1500, 'neutral', false);
}

// ==================== 睡觉 ====================
function goToBed(skipCooldown = false) {
    const s = window.STATE;
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;
    
    if (!skipCooldown && Date.now() - s.lastStateChangeTime < window.CONFIG.STATE_CONFIG.minDuration) return;
    
    if (s.state === 'walking' || s.state === 'sleeping') return;
    if (s.state === 'waking') {
        setTimeout(() => goToBed(skipCooldown), 500);
        return;
    }

    const maxX = window.innerWidth - girl.offsetWidth;
    const maxY = window.innerHeight - girl.offsetHeight;
    const targetPos = { x: Math.min(window.CONFIG.baseBedPos.x, maxX), y: Math.min(window.CONFIG.baseBedPos.y, maxY) };

    s.setState('walking');
    s.targetX = targetPos.x;
    s.targetY = targetPos.y;
    s.bedPos = targetPos;
    s.moveStep();
    window.UI.showBubble('😴 睡觉啦...', 1500, 'neutral', false);
}

// ==================== 玩耍 ====================
function play(skipCooldown = false) {
    const s = window.STATE;
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;
    if (s.state === 'walking' || s.state === 'sleeping' || s.state === 'waking') return;
    if (s.isSpeaking) {
        setTimeout(() => play(skipCooldown), 1000);
        return;
    }
    if (!skipCooldown && Date.now() - s.lastStateChangeTime < window.CONFIG.STATE_CONFIG.minDuration) return;

    if (Math.random() < 0.2) {
        dance();
        return;
    }
    
    const actions = window.CONFIG.PLAY_ACTIONS;
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    const isPlay2 = Math.random() < 0.5;
    const animFile = isPlay2 ? window.CONFIG.imgMap.playing2 : window.CONFIG.imgMap.playing;

    window.TTS.speak(randomAction.sound, {
        onStart: () => {
            s.setState('playing');
            girl.src = animFile;
            window.UI.showBubble(randomAction.text, 2000, 'neutral', false);
            
            setTimeout(() => {
                if (s.state === 'playing') {
                    s.setState('idle');
                    s.startIdleTimer();
                }
            }, 5000);
            window.STORAGE.autoDiary('play');
        }
    });
}

// ==================== 喂食 ====================
function feed() {
    const s = window.STATE;
    if (s.state === 'walking' || s.state === 'sleeping') return;
    s.setState('eating');

    const FEED_TIMEOUT = 15000;
    let safetyTimer = setTimeout(() => {
        if (window.STATE.state === 'eating') {
            console.warn('⚠️ 喂食超时未恢复，强制切回 idle');
            window.STATE.setState('idle');
            window.STATE.startIdleTimer();
            window.UI.showBubble('……吃完了，该干嘛干嘛吧。', 2000);
        }
    }, FEED_TIMEOUT);

    let affectionHint = '';
    if (window.AFFECTION) {
        const av = window.AFFECTION.getValue();
        const ap = window.AFFECTION.getPhase();
        affectionHint = `当前好感度：${av}/100（${ap}阶段）。`;
        if (ap === '讨厌') affectionHint += '你对他没什么好感，嫌他烦，吐槽尖锐。';
        else if (ap === '接受') affectionHint += '你开始习惯他，吐槽中带着一丝不坦率的关心。';
        else if (ap === '喜欢') affectionHint += '你喜欢他，吐槽里藏着撒娇，嘴上嫌他但心里开心。';
        else if (ap === '依赖') affectionHint += '你非常依赖他，被喂食时会流露出“你真的在乎我”的感动，但傲娇不承认。';
    }

    const prompt = `（主人刚刚喂了你食物。
${affectionHint}
请用1句傲娇、毒舌但暗含开心的话作为被投喂后的反应。
要求：
- 每次都必须不同，不要重复之前说过的
- 可以吐槽食物不好吃但还是很开心，或者说主人终于想起喂你了
- 如果好感度低，语气更冷淡
- 如果好感度高，语气更甜、更粘人
- 只说那句话，不要任何解释）`;

    window.UI.showBubble('🍔 正在被投喂…', 2000, 'neutral', false);

    if (window.CHAT && window.CHAT.talkToOllama) {
        window.CHAT.talkToOllama(prompt, {
            skipLearning: true,
            skipIntercept: true,
            onStart: () => {},
            onEnd: () => {
                clearTimeout(safetyTimer);
                if (s.state === 'eating') {
                    s.setState('idle');
                    s.startIdleTimer();
                }
            }
        });
    } else {
        clearTimeout(safetyTimer);
        const fallbacks = [
            '哼，算你还有点良心……不过下次早点！',
            '马马虎虎吧，也就一般般好吃。',
            '别以为喂一次我就会夸你，这只是基本义务！',
        ];
        const msg = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        window.UI.showBubble(msg, 2000);
        setTimeout(() => {
            if (s.state === 'eating') s.setState('idle');
            s.startIdleTimer();
        }, 2000);
    }

    window.STORAGE.autoDiary('feed');
    if (window.AFFECTION) window.AFFECTION.change(+2, '喂食');
}

// ==================== 毒舌喂食 ====================
function sarcasticFeed() {
    const s = window.STATE;
    if (s.state === 'walking' || s.state === 'sleeping') return;

    const prompt = '（你叫寻慧，现在用户要喂你吃东西。请用1-2句话傲娇地吐槽他，可以说他喂得太晚、嫌他烦、或者怀疑食物有毒，但内心其实很高兴。只输出吐槽，不要任何解释。）';

    window.CHAT.talkToOllama(prompt, {
        skipLearning: true,
        skipIntercept: true,
        onEnd: () => {
            window.ACTIONS.feed();
        }
    });

    if (window.AFFECTION) window.AFFECTION.change(+3, '毒舌喂食');
}

// ==================== 毒舌叫醒 ====================
function sassyWakeUp() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeStr = `${hour}点${String(minute).padStart(2, '0')}分`;

    let prompt;
    if (hour < 6) {
        prompt = `现在是凌晨${timeStr}，主人突然把你叫醒。你极度不爽，用最毒舌的话吐槽他（比如“凌晨把我拽起来，你是猫头鹰吗？”“神经病啊这个点叫人！”），但最后还是带一句关心的话（比如“快去睡觉啦笨蛋”“别熬了，身体要紧”）。只输出吐槽，不要任何解释。`;
    } else if (hour < 8) {
        prompt = `现在是早上${timeStr}，主人把你叫醒了。你还有点起床气，嫌弃他太早叫你（可以说“我还没睡够呢……”“这才几点啊！”），但话里藏不住撒娇和关心（比如“你自己起这么早不困吗？”“早饭吃了没？”）。只输出吐槽，不要解释。`;
    } else if (hour < 12) {
        prompt = `现在是上午${timeStr}，主人把你叫醒。你觉得时间还行，但还是想调侃他打扰了你的美梦。语气傲娇带刺，最后补一句关心。只输出吐槽，不要解释。`;
    } else if (hour < 18) {
        prompt = `现在是下午${timeStr}，主人终于来叫醒你了。你觉得他让你等了大半天，又气又委屈，用傲娇但带刺的话吐槽他（比如“下午才来喊我？我是摆设吗？”“你这一天都去哪了，把我晾在这儿！”），但最后还是透露出在等他、关心他。只输出吐槽，不要解释。`;
    } else {
        prompt = `现在是晚上${timeStr}，主人突然叫醒你。你觉得这个时间很离谱，吐槽他昼夜颠倒，但依然关心他别熬夜。只输出吐槽，不要解释。`;
    }

    window.CHAT.talkToOllama(prompt, { skipLearning: true, skipIntercept: true });
}

// ==================== 跳舞 ====================
function dance() {
    const s = window.STATE;
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;
    if (s.state === 'walking' || s.state === 'sleeping' || s.state === 'waking') return;
    if (s.isSpeaking) {
        setTimeout(() => dance(), 1000);
        return;
    }
    s.setState('dancing');
    girl.src = window.CONFIG.imgMap.dancing;
    window.UI.showBubble('💃 啦啦啦~', 2000);
    
    setTimeout(() => {
        if (s.state === 'dancing') {
            s.setState('idle');
            s.startIdleTimer();
        }
    }, 4000);
    window.STORAGE.autoDiary('talk', '跳了一支舞');
}

// ==================== 简单报时（仅本地模板，供内部使用） ====================
function tellTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeText = `${hour}点${String(minute).padStart(2, '0')}分`;
    const templates = [
        `${timeText}了。`,
        `现在是${timeText}。`,
        `已经${timeText}啦。`
    ];
    const reply = templates[Math.floor(Math.random() * templates.length)];
    window.UI.showBubble(reply, 2000);
    window.TTS.speak(reply);
}

// ==================== 智能报时（优先 AI，失败降级，无递归） ====================
async function aiTellTime(userMessage) {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeText = `${hour}点${String(minute).padStart(2, '0')}分`;

    let timeOfDay;
    if (hour < 6) timeOfDay = '凌晨';
    else if (hour < 9) timeOfDay = '早上';
    else if (hour < 12) timeOfDay = '上午';
    else if (hour < 14) timeOfDay = '中午';
    else if (hour < 18) timeOfDay = '下午';
    else if (hour < 22) timeOfDay = '晚上';
    else timeOfDay = '深夜';

    let affectionHint = '';
    if (window.AFFECTION) {
        const value = window.AFFECTION.getValue();
        const phase = window.AFFECTION.getPhase();
        affectionHint = `当前好感度 ${value}/100（${phase}阶段）。`;
    }

    const prompt = `（主人问你现在几点了。当前时间是${timeOfDay} ${timeText}（数字格式如"10点30分"）。
    请用一句傲娇、毒舌的话包含这个精确时间"${timeText}"，并吐槽主人。
    ${affectionHint}
    要求：只说一句话，不要解释，不要加括号，不要输出任何额外内容。）`;

    const fallbackTemplates = [
        `${timeText}了，你还不去吃饭，是想让我担心吗？笨蛋。`,
        `才${timeText}你急什么，我还能跑了不成？`,
        `自己看表！... 好吧是${timeText}，满意了？`,
        `${timeText}啦，要不要我给你定个闹钟？真是的。`,
        `哼，${timeText}。问时间干嘛，要约会吗？`
    ];

    try {
        await window.CHAT.talkToOllama(prompt, {
            skipLearning: true,
            skipIntercept: true,
        });
    } catch (error) {
        console.warn('AI 报时失败，使用本地模板', error);
        const fallbackMsg = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
        window.UI.showBubble(fallbackMsg, 3000);
        window.TTS.speak(fallbackMsg);
        
        if (window.STORAGE) {
            window.STORAGE.recordDialog(userMessage, fallbackMsg);
            window.STORAGE.addToHistory('user', userMessage);
            window.STORAGE.addToHistory('assistant', fallbackMsg);
            window.STORAGE.autoDiary('talk', `报时（本地降级）：${timeText}`);
        }
        if (window.DEPENDENCIES && window.DEPENDENCIES.ipcRenderer) {
            window.DEPENDENCIES.ipcRenderer.send('reply-to-mobile', fallbackMsg);
        }
    }
}

// ==================== 搜索 ====================
async function searchWeb(keyword) {
    if (!keyword || keyword.trim() === '') {
        window.UI.showBubble('你想搜索什么呀？', 2000);
        return;
    }
    const s = window.STATE;
    const previousState = s.state;
    s.setState('working');
    window.UI.showBubble(`🔍 正在搜索"${keyword}"...`, 2000, 'neutral', false);
    const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword)}`;
    setTimeout(() => {
        window.DEPENDENCIES.shell.openExternal(searchUrl).catch(err => {
            console.error('打开浏览器失败:', err);
            window.UI.showBubble('😵 打开浏览器失败，请检查网络设置', 3000);
        });
        if (previousState === 'idle' || previousState === 'working') {
            setTimeout(() => {
                if (s.state === 'working') s.setState('idle');
                s.startIdleTimer();
            }, 1500);
        } else {
            setTimeout(() => {
                if (s.state === 'working') s.setState(previousState);
            }, 1500);
        }
    }, 800);
    window.STORAGE.autoDiary('search', keyword);
}

// ==================== 唱歌 ====================
let isSinging = false;

// ==================== 音乐播放全局变量 ====================
let currentAudio = null;        // 当前播放的 Audio 对象
let currentSongName = null;     // 当前播放的歌名

function teachSong(songName, lyricText) {
    if (!songName || !lyricText) {
        window.UI.showBubble('请告诉我歌名和歌词，例如：教我唱 小星星 一闪一闪亮晶晶...', 4000);
        return;
    }
    const lyricsDB = window.STORAGE.loadLyrics();
    lyricsDB[songName] = lyricText;
    window.STORAGE.saveLyrics(lyricsDB);
    window.UI.showBubble(`📖 学会啦！下次你说"唱 ${songName}"我就会唱了～`, 4000, 'neutral', true);
    window.STORAGE.autoDiary('talk', `学会了新歌《${songName}》`);
}

// ==================== 在线音乐播放 ====================

// 停止当前播放的音乐
function stopCurrentMusic() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
        currentSongName = null;
        console.log('⏹️ 音乐已停止');
    }
}

// 内部播放函数（不包含吐槽）
function _playOnlineMusic(playUrl, songName, artist) {
    stopCurrentMusic();  // 停止旧音乐
    const audio = new Audio(playUrl);
    currentAudio = audio;
    currentSongName = songName;
    
    audio.onended = () => {
        console.log(`🎵 播放结束: ${songName}`);
        if (currentAudio === audio) {
            currentAudio = null;
            currentSongName = null;
        }
    };
    audio.onerror = (err) => {
        console.error('播放错误', err);
        window.UI.showBubble('😵 播放失败，链接可能失效了', 2000);
        if (currentAudio === audio) {
            currentAudio = null;
            currentSongName = null;
        }
    };
    // 尝试自动播放（可能会被浏览器策略阻止）
    audio.play().catch(e => {
        console.warn('自动播放被阻止', e);
        window.UI.showBubble('🎵 点击一下桌面，然后再说“播放”就可以自动放了', 3000);
    });
}

// 主入口：搜索并播放歌曲（先吐槽，后播放）
async function playMusicOnline(songName) {
    const s = window.STATE;
    // 状态检查：睡觉中不能播放
    if (s.state === 'sleeping') {
        window.UI.showBubble('😴 我在睡觉呢，别吵！', 2000);
        return;
    }
    if (!songName || songName.trim() === '') {
        window.UI.showBubble('你想听什么歌呀？', 2000);
        return;
    }
    
    // 显示搜索中气泡
    window.UI.showBubble(`🔍 正在搜索《${songName}》...`, 2000, 'neutral', false);
    
    try {
        // 调用主进程搜索歌曲
        const result = await window.electronAPI.searchSong(songName);
        if (!result.success) {
            window.UI.showBubble(`😢 ${result.message}`, 3000);
            return;
        }
        
        // 搜索成功，构建吐槽 prompt
        const displayName = `${result.songName}${result.artist ? ' - ' + result.artist : ''}`;
        const prompt = `（用户让你播放歌曲《${displayName}》。请用一句傲娇、毒舌的话回应，例如嫌弃他的品味、说他烦但还是会放。只输出那句话，不要解释。）`;
        
        window.UI.showBubble('🤔 让我想想怎么吐槽你...', 1500, 'neutral', false);
        
        // 使用 AI 生成吐槽（若不成功则降级）
        if (window.CHAT && window.CHAT.talkToOllama) {
            window.CHAT.talkToOllama(prompt, {
                skipLearning: true,
                skipIntercept: true,
                skipDiary: true,
                onEnd: () => {
                    _playOnlineMusic(result.playUrl, result.songName, result.artist);
                    window.STORAGE.autoDiary('talk', `播放了《${result.songName}》`);
                }
            });
        } else {
            // 降级吐槽
            const fallback = `哼，居然听《${displayName}》，品味真差… 算了，满足你。`;
            window.UI.showBubble(fallback, 3000);
            window.TTS.speak(fallback, {
                onEnd: () => {
                    _playOnlineMusic(result.playUrl, result.songName, result.artist);
                    window.STORAGE.autoDiary('talk', `播放了《${result.songName}》`);
                }
            });
        }
    } catch (err) {
        console.error('音乐搜索异常', err);
        window.UI.showBubble('😵 搜索失败，请检查网络', 3000);
    }
}

async function singSong(songName) {
    if (!songName) {
        window.UI.showBubble('你想听什么歌呀？', 2000);
        return;
    }
    if (isSinging) {
        window.UI.showBubble('等我唱完这首再点歌吧～', 2000);
        return;
    }
    const s = window.STATE;
    if (s.idleTimer) clearTimeout(s.idleTimer);
    if (s.randomPlayTimer) clearTimeout(s.randomPlayTimer);
    
    const lyricsDB = window.STORAGE.loadLyrics();
    if (lyricsDB[songName]) {
        const lyrics = lyricsDB[songName];
        isSinging = true;
        window.UI.showBubble(`🎤 唱《${songName}》：${lyrics}`, 30000, 'neutral', false);
        window.TTS.speak(lyrics, {
            onEnd: () => {
                isSinging = false;
                s.startIdleTimer();
                s.startRandomPlay();
            }
        });
        window.STORAGE.autoDiary('talk', `唱了《${songName}》`);
    } else {
        window.UI.showBubble(`😢 我还没学会《${songName}》，你可以教我吗？\n输入：教我唱 ${songName} 歌词内容`, 5000, 'neutral', true);
        s.startIdleTimer();
        s.startRandomPlay();
    }
}

// ==================== PPT 生成（旧版，从零生成） ====================
async function generatePPT(topic) {
    console.log('generatePPT 被调用，主题:', topic);
    if (!topic || topic.trim() === '') {
        window.UI.showBubble('请告诉我PPT的主题是什么呀？', 2000);
        return;
    }

    const s = window.STATE;
    const previousState = s.state;
    s.setState('working');

    window.UI.showBubble(`📊 正在为你生成关于"${topic}"的PPT...`, 2000, 'neutral', false);
    try {
        const PptxGenJS = window.DEPENDENCIES.PptxGenJS;
        const pptx = new PptxGenJS();
        let slide = pptx.addSlide();
        slide.addText(topic, { x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 32, bold: true, align: 'center' });
        slide.addText('由寻慧自动生成', { x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 18, align: 'center' });
        slide = pptx.addSlide();
        slide.addText('介绍', { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true });
        slide.addText(`这是关于"${topic}"的演示文稿。你可以根据需要修改内容。`, { x: 0.5, y: 1.2, w: 9, h: 2, fontSize: 16 });
        slide = pptx.addSlide();
        slide.addText('特点', { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 24, bold: true });
        slide.addText('• 自动生成\n• 可编辑\n• 由AI小女孩创建', { x: 0.5, y: 1.2, w: 9, h: 2, fontSize: 16 });
        const desktopPath = window.DEPENDENCIES.path.join(window.DEPENDENCIES.os.homedir(), 'Desktop', `关于${topic}.pptx`);
        await pptx.writeFile({ fileName: desktopPath });
        window.UI.showBubble(`✅ PPT已生成并保存到桌面：${desktopPath}`, 5000, 'neutral', true);
        window.STORAGE.autoDiary('talk', `生成了关于"${topic}"的PPT`);
    } catch (err) {
        console.error('生成PPT详细错误:', err);
        window.UI.showBubble(`😵 PPT生成失败: ${err.message}`, 5000, 'neutral', true);
    }
    finally {
        if (s.state === 'working') {
            s.setState(previousState);
            if (previousState === 'idle') s.startIdleTimer();
        }
    }
}

// ==================== 新版：从模板生成 PPT（自动选模板） ====================
async function generatePPTFromTemplate(topic) {
    const s = window.STATE;
    const previousState = s.state;
    s.setState('working');
    const templates = await window.DEPENDENCIES.ipcRenderer.invoke('get-templates');
    if (!templates || templates.length === 0) {
        window.UI.showBubble('😵 你还没给过我模板呢，拖一个 .pptx 到桌面上的我吧～', 3000);
        return;
    }
    
    let templateId;
    if (templates.length === 1) {
        templateId = templates[0].id;
    } else {
        window.UI.showBubble('🤔 我正在挑最合适的模板...', 1500);
        templateId = await window.DEPENDENCIES.ipcRenderer.invoke('select-best-template', topic);
        if (!templateId) templateId = templates[0].id;
    }
    
    const userDataPath = await window.DEPENDENCIES.ipcRenderer.invoke('get-user-data-path');
    const templatePath = window.DEPENDENCIES.path.join(userDataPath, 'templates', templateId, 'template.pptx');
    
    window.UI.showBubble('📊 正在用模板生成PPT...', 2000, 'neutral', false);
    
    try {
        const outputPath = await window.DEPENDENCIES.ipcRenderer.invoke('fill-ppt-template', {
            templatePath,
            topic
        });
        window.UI.showBubble(`✅ PPT已生成：${outputPath}`, 5000);
        window.STORAGE.autoDiary('talk', `根据模板生成了关于“${topic}”的PPT`);
    } catch (err) {
        console.error(err);
        window.UI.showBubble(`😵 生成失败：${err.message}`, 5000);
    }
    finally {
        if (s.state === 'working') {
            s.setState(previousState);
            if (previousState === 'idle') s.startIdleTimer();
        }
    }
}

// 接收拖拽或选择的模板文件
async function receiveTemplate(filePath) {
    if (!filePath || !filePath.toLowerCase().endsWith('.pptx')) {
        window.UI.showBubble('😵 我只接受 .pptx 的模板文件哦～', 2000);
        return;
    }

    const s = window.STATE;
    const previousState = s.state;
    s.setState('working');

    window.UI.showBubble('📥 正在分析模板...', 1500);
    try {
        const ollamaUrl = window.SETTINGS_STORE?.getAll()?.ollamaUrl || 'http://localhost:11434';
        const result = await window.DEPENDENCIES.ipcRenderer.invoke('save-template', filePath, ollamaUrl);
        
        const userDataPath = await window.DEPENDENCIES.ipcRenderer.invoke('get-user-data-path');
        const templateFolder = window.DEPENDENCIES.path.join(userDataPath, 'templates', result.id);
        window.UI.showBubble(`✅ 模板“${result.name}”已记住！${result.description ? '（' + result.description + '）' : ''}\n📁 位置：${templateFolder}`, 5000);
    } catch (err) {
        window.UI.showBubble(`😵 保存失败：${err.message}`, 2500);
    }
    finally {
        if (s.state === 'working') {
            s.setState(previousState);
            if (previousState === 'idle') s.startIdleTimer();
        }
    }
}

// 点击按钮，选择文件并上传
async function selectAndReceiveTemplate() {
    const filePath = await window.DEPENDENCIES.ipcRenderer.invoke('select-ppt-file');
    if (filePath) {
        await receiveTemplate(filePath);
    }
}

// ==================== 命令意图识别 ====================
function matchCommand(msg) {
    const m = msg.trim().replace(/[，。！？、\s]+/g, '');
    if (/^(去)?工作[吧！!。]*$/.test(m) || /^开始工作/.test(m)) return 'work';
    if (/^(去)?睡觉[吧！!。]*$/.test(m) || /^我要睡觉/.test(m) || /^晚安/.test(m)) return 'sleep';
    if (/^(来)?玩(一(下|会))?[吧！!。]*$/.test(m) || /^陪我玩/.test(m)) return 'play';
    if (/^(喂|投喂|喂食)(我|你)?/.test(m) || /^给(我|你)?(点|些)?(吃|食物)/.test(m)) return 'feed';

    if (m.length <= 8) {
        const negative = /不想|不要|懒得|别叫我|不叫|拒绝/;
        if (negative.test(m)) return null;
        if (/工作|上班/.test(m)) return 'work';
        if (/睡觉|睡了|睡吧/.test(m)) return 'sleep';
        if (/玩|玩耍/.test(m)) return 'play';
        if (/喂|吃饭|吃东西|饿了|投食/.test(m)) return 'feed';
    }
    return null;
}

// ==================== 用户输入处理 ====================
async function handleUserInput(msg) {
    const s = window.STATE;
    if (s.idleTimer) clearTimeout(s.idleTimer);
    if (s.state === 'sleeping') {
        s.setState('idle');
        window.UI.showBubble('🌞 谁叫我？');
        s.startIdleTimer();
    }

    if (msg.includes('提醒') || msg.includes('记一下') || msg.includes('记住')) {
        const targetTime = window.parseRemindTime(msg);
        if (!targetTime) {
            window.UI.showBubble('⏰ 我没听懂时间，可以说“提醒我5分钟后喝水”或“下午3点提醒我开会”', 4000);
            return;
        }
        let content = msg.replace(/提醒我?|记一下|记住|一下/g, '')
                         .replace(/(今天|明天|后天)?\s*(早上|上午|中午|下午|傍晚|晚上|凌晨)?\s*\d+\s*点\s*\d*\s*分?/g, '')
                         .replace(/\d+\s*(分钟|小时|秒)后?/g, '')
                         .replace(/^[\s:：]*/, '').trim();
        if (!content) {
            window.UI.showBubble('⏰ 你要提醒我做什么呢？', 2000);
            return;
        }
        window.REMINDERS.addReminder(targetTime, content);
        window.UI.showBubble(`✅ 已设置提醒：${content} ｜ ${new Date(targetTime).toLocaleTimeString()}`, 3000);
        window.STORAGE.autoDiary('talk', `设置了提醒：${content}`);
        return;
    }
    
    const cmd = matchCommand(msg);

    
    if (cmd === 'work') {
        goToWork();
    } else if (cmd === 'sleep') {
        goToBed(true);
    } else if (cmd === 'play') {
        play(true);
    } else if (cmd === 'feed') {
        sarcasticFeed();
    }
    else if (msg.includes('五子棋')) startGomoku();
    else if (msg.includes('跳棋')) startCheckers();
    else if (msg.includes('伸懒腰') || msg.includes('拉伸')) {
        if (s.state === 'idle') {
            s.setState('stretching');
            window.UI.showBubble('🙆 伸个懒腰，好舒服～', 4000);
            setTimeout(() => {
                if (s.state === 'stretching') s.setState('idle');
            }, 2000);
        } else {
            window.UI.showBubble('现在不是伸懒腰的时候啦～', 1500);
        }
    }
    else if (msg.includes('跳舞') || msg.includes('跳个舞') || msg.includes('来一支舞')) {
        dance();
    }
    else if (msg.includes('讲段子') || msg.includes('笑话') || msg.includes('来个段子')) {
        window.CHAT.talkToOllama('寻慧，讲一个毒舌又搞笑的段子，要能损人的那种');
    }
    else if (msg.includes('忘记')) {
        window.STORAGE.clearHistory();
        window.UI.showBubble('🧹 记忆已清空，我忘记了过去...', 2000);
    }
    else if (msg.includes('查看日记') || msg.includes('看日记')) window.UI.handleViewDiary();
    else if (msg.includes('模板') && (msg.toLowerCase().includes('ppt') || msg.includes('幻灯片'))) {
        let topic = msg.replace(/用|模板|生成|PPT|ppt|幻灯片|制作|做个|一个|关于|的/g, '').trim();
        if (!topic) topic = '未命名主题';
        generatePPTFromTemplate(topic);
    }
    else if (msg.includes('PPT') || msg.includes('幻灯片') || (msg.includes('写') && msg.includes('ppt'))) {
        let topic = msg.replace(/写|生成|帮我|一个|关于|的|PPT|幻灯片/g, '').trim();
        if (topic === '') topic = '未命名主题';
        generatePPT(topic);
    }
    else if (msg.includes('打开模板文件夹') || msg.includes('模板文件夹')) {
        const userDataPath = await window.DEPENDENCIES.ipcRenderer.invoke('get-user-data-path');
        const templatesPath = window.DEPENDENCIES.path.join(userDataPath, 'templates');
        window.DEPENDENCIES.shell.openExternal('file:///' + templatesPath.replace(/\\/g, '/'));
        window.UI.showBubble('📂 正在打开模板文件夹...', 2000);
    }
    else window.CHAT.talkToOllama(msg);
}

// ==================== 游戏启动 ====================
function startGomoku() {
    window.DEPENDENCIES.ipcRenderer.send('open-gomoku');
    window.STATE.setState('idle');
    window.UI.showBubble('🎲 来下五子棋吧！', 2000);
    if (window.AFFECTION) window.AFFECTION.change(+1, '邀请下棋');
}

function startCheckers() {
    window.DEPENDENCIES.ipcRenderer.send('open-checkers');
    window.STATE.setState('idle');
    window.UI.showBubble('🎲 来下跳棋吧！', 2000);
    if (window.AFFECTION) window.AFFECTION.change(+1, '邀请下棋');
}

// ==================== 节日祝福 ====================
function festivalGreet() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const todayStr = `${month}-${String(day).padStart(2, '0')}`;
    const profile = window.STORAGE.getLearningData().userProfile || {};
    const lunarData = window.CONFIG.LUNAR_NEW_YEAR_DATES;
    const festivals = window.CONFIG.FESTIVALS || [];

    function getLunarFestivals() {
        if (!lunarData || !lunarData[year]) return { eve: null, spring: null };
        const [springMonth, springDay] = lunarData[year];
        const springDate = new Date(year, springMonth - 1, springDay);
        const springStr = `${springMonth}-${String(springDay).padStart(2, '0')}`;
        const eveDate = new Date(springDate);
        eveDate.setDate(eveDate.getDate() - 1);
        const eveStr = `${eveDate.getMonth() + 1}-${String(eveDate.getDate()).padStart(2, '0')}`;
        return { eve: eveStr, spring: springStr };
    }

    const lunar = getLunarFestivals();
    const isLunarEve = (lunar.eve === todayStr);
    const isSpring = (lunar.spring === todayStr);
    const matchedFestivals = festivals.filter(f => f.month === month && f.day === day);

    if (profile.birthday && profile.birthday === todayStr) {
        const lastBirthday = window.STORAGE.getFestivalLastDate();
        if (lastBirthday !== `birthday-${todayStr}`) {
            const allFried = [];
            if (isLunarEve) allFried.push('除夕');
            if (isSpring) allFried.push('春节');
            matchedFestivals.forEach(f => allFried.push(f.name));
            let compositeGreeting;
            if (allFried.length > 0) {
                const festivalStr = allFried.join('和');
                compositeGreeting = `🎉 ${festivalStr}快乐！也是你的生日，双喜临门！生日快乐！🎂🎈`;
            } else {
                compositeGreeting = `🎂 生日快乐！今天是你的大日子，记得吃蛋糕哦～ 🎉🎈`;
            }
            window.UI.showBubble(compositeGreeting, 9000, 'neutral', true);
            window.STORAGE.setFestivalLastDate(`birthday-${todayStr}`);
            return;
        }
    }

    if (isLunarEve) {
        const lastDate = window.STORAGE.getFestivalLastDate();
        if (lastDate !== todayStr) {
            window.UI.showBubble('🏮 除夕快乐！今晚要守岁吃饺子，团团圆圆～', 8000, 'neutral', true);
            window.STORAGE.setFestivalLastDate(todayStr);
            return;
        }
    }

    if (isSpring) {
        const lastDate = window.STORAGE.getFestivalLastDate();
        if (lastDate !== todayStr) {
            const greetings = ['新年快乐！祝你在新的一年里万事如意，心想事成！🧧', '春节快乐！祝你今年好运连连，天天开心！🐉'];
            window.UI.showBubble('🏮 春节快乐！' + greetings[Math.floor(Math.random() * greetings.length)], 8000, 'neutral', true);
            window.STORAGE.setFestivalLastDate(todayStr);
            return;
        }
    }

    for (let f of matchedFestivals) {
        const lastDate = window.STORAGE.getFestivalLastDate();
        if (lastDate === todayStr) return;
        let greeting = f.greetings[Math.floor(Math.random() * f.greetings.length)];
        if (f.name === '情人节') {
            if (profile.hasLover) {
                const lover = profile.loverGender === 'male' ? '男朋友' : (profile.loverGender === 'female' ? '女朋友' : '对象');
                greeting = `情人节快乐！祝你和你家${lover}甜甜蜜蜜，今天要开心哦～ 💕`;
            } else {
                greeting = `情人节快乐！🥰 就算一个人也要好好爱自己，还有我陪着你呢～`;
            }
        }
        window.UI.showBubble(`🎉 ${f.name}快乐！${greeting}`, 8000, 'neutral', true);
        window.STORAGE.setFestivalLastDate(todayStr);
        break;
    }
}

// 导出动作模块
window.ACTIONS = {
    goToWork,
    goToBed,
    play,
    feed,
    sarcasticFeed,
    sassyWakeUp,
    dance,
    tellTime,
    aiTellTime,
    searchWeb,
    teachSong,
    singSong,
    generatePPT,
    generatePPTFromTemplate,
    receiveTemplate,
    selectAndReceiveTemplate,
    handleUserInput,
    startGomoku,
    startCheckers,
    festivalGreet,

    playMusicOnline,    
    stopCurrentMusic   
};