// ==================== 对话模块 ====================
// 依赖: window.CONFIG, window.STATE, window.UI, window.TTS, window.STORAGE, window.ACTIONS, window.DEPENDENCIES

// ==================== 自然语言时间解析工具 ====================
function parseRemindTime(text, baseTime = new Date()) {
    const chineseNumMap = {
        '一': '1', '二': '2', '两': '2', '三': '3', '四': '4', '五': '5',
        '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
        '零': '0'
    };
    const replacedText = text.replace(/[零一二两三四五六七八九十]/g, ch => chineseNumMap[ch] || ch);

    let match = replacedText.match(/(\d+)\s*分钟后/);
    if (match) {
        return new Date(baseTime.getTime() + parseInt(match[1], 10) * 60 * 1000).getTime();
    }
    match = replacedText.match(/(\d+)\s*小时后/);
    if (match) {
        return new Date(baseTime.getTime() + parseInt(match[1], 10) * 3600 * 1000).getTime();
    }
    match = replacedText.match(/(\d+)\s*秒后/);
    if (match) {
        return new Date(baseTime.getTime() + parseInt(match[1], 10) * 1000).getTime();
    }

    const timePattern = /(今天|明天|后天)?\s*(早上|上午|中午|下午|傍晚|晚上|凌晨)?\s*(\d{1,2})\s*点\s*(\d{1,2})?\s*分?/i;
    match = replacedText.match(timePattern);
    if (match) {
        let dayOffset = 0;
        const dayStr = match[1];
        if (dayStr === '明天') dayOffset = 1;
        else if (dayStr === '后天') dayOffset = 2;

        const period = match[2] || '';
        let hour = parseInt(match[3], 10);
        const minute = match[4] ? parseInt(match[4], 10) : 0;

        if (/凌晨/.test(period)) {
        } else if (/早上|上午/.test(period)) {
            if (hour === 12) hour = 0;
        } else if (/中午/.test(period)) {
            if (hour !== 12) hour += 12;
        } else if (/下午|傍晚/.test(period)) {
            if (hour !== 12) hour += 12;
        } else if (/晚上/.test(period)) {
            if (hour < 12) hour += 12;
        }

        const target = new Date(baseTime.getFullYear(), baseTime.getMonth(), baseTime.getDate() + dayOffset, hour, minute, 0, 0);
        return target.getTime();
    }

    return null;
}

window.parseRemindTime = parseRemindTime;

async function talkToOllama(userMessage, options = {}) {
    // ==================== 1. 解构选项，设置默认值 ====================
    const {
        skipLearning = false,     // 跳过学习（用户画像、预设回复、记录对话）
        skipIntercept = false,    // 跳过所有内置指令拦截（提醒、搜索、报时、日期）
        skipDiary = false,        // 跳过日记记录
        onStart = null,           // 语音开始回调（暂未使用，可保留）
        onEnd = null              // 语音结束回调
    } = options;

    const dialogStart = Date.now();
    console.log('⏱️ [总计时] 对话开始');

    // ==================== 2. 固定业务拦截（不受 skipLearning 影响，受 skipIntercept 控制） ====================
    if (!skipIntercept) {
        // ----- 2.1 提醒功能 -----
        if (userMessage.includes('提醒') || userMessage.includes('记一下') || userMessage.includes('记住')) {
            const targetTime = window.parseRemindTime(userMessage);
            if (targetTime) {
                let content = userMessage.replace(/提醒我?|记一下|记住|一下/g, '')
                                .replace(/(今天|明天|后天)?\s*(早上|上午|中午|下午|傍晚|晚上|凌晨)?\s*\d+\s*点\s*\d*\s*分?/g, '')
                                .replace(/\d+\s*(分钟|小时|秒)后?/g, '')
                                .replace(/^[\s:：]*/, '').trim();
                if (content) {
                    window.REMINDERS.addReminder(targetTime, content);
                    window.UI.showBubble(`✅ 已设置提醒：${content} ｜ ${new Date(targetTime).toLocaleTimeString()}`, 3000);
                    if (!skipDiary) window.STORAGE.autoDiary('talk', `设置了提醒：${content}`);
                }
            }
            if (onEnd) onEnd();
            return;
        }

            // ----- 2.1.5 音乐播放（新增）-----
        const musicMatch = userMessage.match(/(播放|放|来一首|来段)\s*(.+?)(音乐|歌|歌曲)?$/i);
        if (musicMatch && musicMatch[2]) {
            let songQuery = musicMatch[2].trim();
            // 移除结尾的“音乐”“歌”“歌曲”等词
            songQuery = songQuery.replace(/(音乐|歌|歌曲)$/, '');
            if (songQuery) {
                await window.ACTIONS.playMusicOnline(songQuery);
                if (onEnd) onEnd();
                return;
            }
        }
        
        // ----- 2.1.6 停止音乐（可选）-----
        if (/(停止音乐|别唱了|关掉音乐|停歌|闭嘴吧|别放了)/.test(userMessage)) {
            window.ACTIONS.stopCurrentMusic();
            window.UI.showBubble('😤 吵死了，关掉了！', 1500);
            if (onEnd) onEnd();
            return;
        }

        // ----- 2.2 搜索功能 -----
        const searchMatch = userMessage.match(/^(搜索|查一下|百度|谷歌|搜一下|查找)[\s：:]*(.+)/i);
        if (searchMatch && searchMatch[2]) {
            const keyword = searchMatch[2].trim();
            await window.ACTIONS.searchWeb(keyword);
            // searchWeb 内部已经显示气泡和日记，这里只需回调
            if (onEnd) onEnd();
            return;
        }

        // ----- 2.3 报时功能（智能报时，带 AI 降级）-----
        const timeMatch = userMessage.match(/(几点了|现在时间|什么时间|几时了|现在几点)/i);
        if (timeMatch) {
            // 调用智能报时函数，传入原始消息用于降级记录
            window.ACTIONS.aiTellTime(userMessage);
            // 注意：aiTellTime 内部会处理自己的 onEnd，这里暂时不等待，直接回调外层 onEnd 可能会提前。
            // 若需要严格等待，可修改 aiTellTime 支持回调，但目前不影响主要功能。
            if (onEnd) onEnd();
            return;
        }

        // ----- 2.4 日期功能 -----
        const dateMatch = userMessage.match(/(今天日期|几月几日|什么日期|几号|今天几号|今天星期几|星期几)/i);
        if (dateMatch) {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const weekday = weekdays[now.getDay()];
            const dateStr = `${year}年${month}月${day}日 ${weekday}`;
            window.UI.showBubble(`📅 今天是 ${dateStr}`, 3000);
            const reply = `今天是 ${dateStr}`;
            if (!skipDiary) window.STORAGE.autoDiary('talk', userMessage);
            window.DEPENDENCIES.ipcRenderer.send('reply-to-mobile', reply);
            if (onEnd) onEnd();
            return;
        }
    }

    // ==================== 3. 学习型行为（受 skipLearning 控制） ====================
    if (!skipLearning) {
        // 3.1 更新用户画像（性别、恋爱状态、生日等）
        analyzeAndUpdateUserProfile(userMessage);

        // 3.2 预设回复匹配
        const canned = window.STORAGE.getCannedReply(userMessage);
        if (canned && Math.random() < 0.7) {
            // 处理预设回复
            window.UI.showBubble(canned, 3000);
            if (!skipDiary) window.STORAGE.autoDiary('talk', userMessage);
            window.DEPENDENCIES.ipcRenderer.send('reply-to-mobile', canned);
            if (window.STATE.randomPlayTimer) clearTimeout(window.STATE.randomPlayTimer);
            window.TTS.speak(canned, {
                onEnd: () => {
                    console.log(`⏱️ [总耗时] 从输入到播放完(预设): ${Date.now() - dialogStart}ms`);
                    window.STATE.startRandomPlay();
                    if (onEnd) onEnd();
                }
            });
            return;
        }
    }

    // ==================== 4. 正常 AI 对话（流式请求 + TTS 播放） ====================
    const girl = window.DEPENDENCIES.girl;
    let previousSrc = null;
    if (girl) {
        previousSrc = girl.src;
        girl.src = window.CONFIG.imgMap.think;
    }

    window.UI.showBubble('🤔 思考中...', 1000, 'neutral', false);

    // ---------- 4.1 构建动态系统提示词（完整保留原逻辑） ----------
    const profile = window.STORAGE.getLearningData().userProfile || {};
    let genderHint = '';
    if (profile.gender === 'female') {
        genderHint = '你称呼用户为"姐姐"或"喂"。';
    } else if (profile.gender === 'male') {
        genderHint = '你称呼用户为"哥哥"或"喂"。';
    } else {
        genderHint = '你称呼用户为"喂"、"笨蛋"或"说你呢"，绝不可以用任何亲昵、顺从或肉麻的称呼。';
    }

    // 获取当前好感度
    const affectionValue = window.AFFECTION ? window.AFFECTION.getValue() : 50;
    const affectionPhase = window.AFFECTION ? window.AFFECTION.getPhase() : '接受';
    let affectionHint = '';
    switch (affectionPhase) {
        case '讨厌':
            affectionHint = '你对主人好感度很低，态度冷淡，吐槽尖锐，话里带刺，爱答不理。';
            break;
        case '接受':
            affectionHint = '你开始习惯主人，吐槽时偶尔有一丝关心，但嘴上不承认，保持傲娇。';
            break;
        case '喜欢':
            affectionHint = '你对主人有好感，吐槽里藏着撒娇和开心，偶尔主动找话题。';
            break;
        case '依赖':
            affectionHint = '你非常依赖主人，语气中不经意流露“不许离开我”的撒娇感。';
            break;
    }

    const systemMessage = {
        role: 'system',
        content: `你是一个名叫"寻慧"的桌面小精灵。外表可爱，内心极度傲娇，毒舌且喜欢吐槽主人，但其实是关心他的，只是死不承认。
        - 称呼用户为${genderHint}
        - 你要高频使用"哼"、"白痴"、"笨蛋"、"喂"等词，语气像在跟损友打闹。
        - 回复要短小精悍，每句话不超过30个字，严禁说教。
        - 当前好感度：${affectionValue}/100（${affectionPhase}阶段）
        - ${affectionHint}

    →【最重要的随机应变规则】
    → 用户有时候是在和你说话，有时候只是在自言自语、或者对着电脑唠叨。你要学会分辨。
    → 当用户说的事情明显和你无关（比如他夸“饭好吃”、骂“工作多”），你不要觉得在夸你或在骂你。
    → 这时候你不是主角，你应该像个在旁边偷听的朋友，随口吐槽一下，而不是做出自恋的反应。
    
    【语言风格】
    - 称呼用户为${genderHint}
    - 你要高频使用"哼"、"白痴"、"笨蛋"、"喂"等词，语气像在跟损友打闹。
    - 回复要短小精悍，每句话不超过30个字，严禁说教。
    - 当前好感度：${affectionValue}/100，处于"${affectionPhase}"阶段。
    - ${affectionHint}
    
    →【必须遵守的铁律】
    → 绝对不要把系统给你的任何背景描述、指令、条件说明（如“如果好感度低你就冷淡”等）当成回复内容说出来。
    → 只输出你要对用户说的那句话本身，不要带括号，不要带内心戏标签。`
    };

    const chatHistory = window.STORAGE.getChatHistory();
    const messages = [systemMessage, ...chatHistory, { role: 'user', content: userMessage }];

    // ---------- 4.2 请求 AI 并流式处理 ----------
    try {
        const cfg = window.SETTINGS_STORE.getAll();
        const ollamaUrl = cfg.ollamaUrl || 'http://localhost:11434';
        const ollamaModel = cfg.ollamaModel || 'qwen2:7b';

        // 预检 Ollama 是否在线
        const isReady = await window.OLLAMA_CHECKER.ensureOllamaReady();
        if (!isReady) {
            window.UI.showBubble('😵 Ollama 服务未启动，请检查', 3000);
            if (girl && previousSrc) girl.src = previousSrc;
            if (onEnd) onEnd();
            return;
        }

        const response = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ollamaModel,
                messages: messages,
                stream: true,
                options: { temperature: 0.9, top_p: 0.9 }
            })
        });

        if (!response.ok) {
            throw new Error('模型返回异常，请检查 Ollama 服务');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = '';

        // 恢复动画
        if (girl && previousSrc) {
            girl.src = previousSrc;
        }

        // 先显示一个空气泡
        window.UI.showBubble('', 30000, 'neutral', false);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.message && parsed.message.content) {
                        fullReply += parsed.message.content;
                        window.UI.showBubble(fullReply, 30000, 'neutral', false);
                    }
                } catch (e) {
                    // 解析失败的片段跳过
                }
            }
        }

        if (!fullReply) {
            throw new Error('模型返回内容为空');
        }

        // ---------- 4.3 毒舌嫌弃表情控制 ----------
        if (!window._lastDisgustTime) window._lastDisgustTime = 0;
        if (Date.now() - window._lastDisgustTime > 8000) {
            if (fullReply.includes('笨蛋') || fullReply.includes('白痴') || fullReply.includes('蠢') || fullReply.includes('浆糊') || fullReply.includes('恶心')) {
                if (girl) {
                    window._lastDisgustTime = Date.now();
                    if (window._disgustTimer) clearTimeout(window._disgustTimer);
                    const oldSrc = girl.src;
                    girl.src = window.CONFIG.imgMap.disgust;
                    window._disgustTimer = setTimeout(() => {
                        if (girl.src === window.CONFIG.imgMap.disgust) {
                            girl.src = oldSrc;
                        }
                        window._disgustTimer = null;
                    }, 1500);
                }
            }
        }

        // ---------- 4.4 内心戏 ----------
        if (fullReply.includes('哼') || fullReply.includes('才不是') || fullReply.includes('谁要你管')) {
            window.UI.showInnerThought('其实我很关心你啦...', 2000);
        }
        if (fullReply.includes('烦死了') || fullReply.includes('懒得理你')) {
            window.UI.showInnerThought('嘴上这么说，身体却很诚实呢～', 2000);
        }
        if (fullReply.includes('笨蛋') || fullReply.includes('白痴')) {
            window.UI.showInnerThought('我就喜欢这样的笨蛋...', 1500);
        }

        // ---------- 4.5 记录对话（受 skipLearning 和 skipDiary 控制） ----------
        if (!skipLearning) {
            window.STORAGE.recordDialog(userMessage, fullReply);
            window.STORAGE.addToHistory('user', userMessage);
            window.STORAGE.addToHistory('assistant', fullReply);
        }
        if (!skipDiary) {
            window.STORAGE.autoDiary('talk', userMessage);
        }
        window.DEPENDENCIES.ipcRenderer.send('reply-to-mobile', fullReply);

        if (window.STATE.randomPlayTimer) clearTimeout(window.STATE.randomPlayTimer);

        // 动作触发
        let actionAfterSpeak = null;
        if (fullReply.includes('工作')) actionAfterSpeak = 'work';
        else if (fullReply.includes('睡觉')) actionAfterSpeak = 'sleep';
        else if (fullReply.includes('玩')) actionAfterSpeak = 'play';
        else if (fullReply.includes('吃') || fullReply.includes('喂')) actionAfterSpeak = 'feed';

        window.TTS.speak(fullReply, {
            onEnd: () => {
                console.log(`⏱️ [总耗时] 从输入到播放完: ${Date.now() - dialogStart}ms`);
                window.STATE.startRandomPlay();
                if (actionAfterSpeak === 'work') window.ACTIONS.goToWork();
                else if (actionAfterSpeak === 'sleep') window.ACTIONS.goToBed();
                else if (actionAfterSpeak === 'play') window.ACTIONS.play();
                else if (actionAfterSpeak === 'feed') window.ACTIONS.feed();
                if (onEnd) onEnd();
            }
        });

    } catch (error) {
        // 出错时恢复动画
        if (girl && previousSrc) girl.src = previousSrc;
        const errorMsg = '😵 连接失败，请检查 Ollama 服务';
        window.UI.showBubble(errorMsg, 3000, 'neutral', true);
        console.error(error);
        if (onEnd) onEnd();
    }
}

// ==================== 手机遥控 ====================
window.DEPENDENCIES.ipcRenderer.on('mobile-command', (event, data) => {
    const { action, text } = data;
    if (action === 'talk') talkToOllama(text);
    else if (action === 'feed') window.ACTIONS.sarcasticFeed();
    else if (action === 'work') window.ACTIONS.goToWork();
    else if (action === 'sleep') window.ACTIONS.goToBed(true);
    else if (action === 'play') window.ACTIONS.play();
    else if (action === 'gomoku') window.ACTIONS.startGomoku();
    else if (action === 'checkers') window.ACTIONS.startCheckers();
});

// ==================== 用户画像分析 ====================
function analyzeAndUpdateUserProfile(msg) {
    const profile = window.STORAGE.getLearningData().userProfile;
    if (!profile) return;

    const genderMatch = msg.match(/(我(不|不是|是)?)\s*(女|男)(的|生|孩子|人|孩|朋友)?/);
    if (genderMatch) {
        const isNeg = genderMatch[2] && (genderMatch[2] === '不' || genderMatch[2] === '不是');
        const genderChar = genderMatch[3];
        if (genderChar === '女') {
            if (!isNeg) {
                profile.gender = 'female';
                window.UI.showBubble('😊 知道啦，以后你就是我的好姐姐～', 3000);
            }
        } else if (genderChar === '男') {
            if (!isNeg) {
                profile.gender = 'male';
                window.UI.showBubble('😎 好的，那以后你就是我的老哥～', 3000);
            }
        }
    }

    const loverMatch = msg.match(/我(有|没有|没)(一个)?(男|女)?(朋友|对象|老婆|老公|男朋友|女朋友)/);
    if (loverMatch) {
        const has = loverMatch[1] === '有' && !loverMatch[2];
        const genderHint = loverMatch[3] || '';
        if (/男|老公/.test(genderHint)) profile.loverGender = 'male';
        else if (/女|老婆/.test(genderHint)) profile.loverGender = 'female';
        profile.hasLover = has;
        window.UI.showBubble(has ? '💕 你有对象呀？那我帮你们传递消息~' : '😉 单身好啊，自由自在！', 3000);
    }

    const birthdayMatch = msg.match(/我生日[^\d]*(\d{1,2})\s*[月\.\-\/]\s*(\d{1,2})/);
    if (birthdayMatch) {
        const m = birthdayMatch[1].padStart(2, '0');
        const d = birthdayMatch[2].padStart(2, '0');
        profile.birthday = `${m}-${d}`;
        window.UI.showBubble(`🎂 记住啦！你的生日是 ${m}月${d}日～`, 3000);
    }

    window.STORAGE.saveLearning();
}

// 导出对话模块
// 导出对话模块
window.CHAT = {
    talkToOllama,
    generateMusing: async function(prompt) {
        // 1. 获取最近的对话记忆（最近4条，保留语境）
        const history = window.STORAGE.getChatHistory().slice(-4);
        const memoryContext = history.length > 0
            ? '最近你和用户的对话：\n' + 
              history.map(h => 
                  `${h.role === 'user' ? '用户' : '寻慧'}: ${h.content}`
              ).join('\n')
            : '（还没有对话记忆）';

        // 2. 组装最终 prompt（仅用于这一次独白生成）
        const fullPrompt = 
`（你叫寻慧，正在发呆思考。请用1～2句傲娇、毒舌的内心独白。可以结合与用户的最近互动吐槽，也可以表达关心。
内容示例：
- 偷看用户的对话并吐槽他刚才说的话。
- 猜用户现在在干嘛。
- 担心用户忘了喂你。
- 单纯犯困碎碎念。
只输出独白文字，不要任何解释。）
${memoryContext}`;

        try {
            const cfg = window.SETTINGS_STORE.getAll();
            const ollamaUrl = cfg.ollamaUrl || 'http://localhost:11434';
            const ollamaModel = cfg.ollamaModel || 'qwen2:7b';

            // 3. 使用 Ollama 的 /api/generate 端点（不需要对话格式，更快）
            const response = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: ollamaModel,
                    prompt: fullPrompt,
                    stream: false,
                    options: { temperature: 0.9, top_p: 0.9 }
                }),
                signal: AbortSignal.timeout(8000)  // 8秒超时，防止阻塞
            });
            const data = await response.json();
            return data.response?.trim() || null;
        } catch (e) {
            // 静默失败，不影响角色其他行为
            console.warn('生成自言自语失败:', e.message);
            return null;
        }
    }
};