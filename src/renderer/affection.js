// ==================== 好感度管理模块 ====================
// 依赖: window.STORAGE, window.CHAT

function changeAffection(delta, reason = '') {
    const data = window.STORAGE.getLearningData();
    if (!data.affection) return;
    
    const aff = data.affection;
    const now = Date.now();
    
    if (now - aff.lastChange < aff.cooldown) return;
    aff.lastChange = now;
    
    const oldValue = aff.value;
    aff.value = Math.max(0, Math.min(100, aff.value + delta));
    const newValue = aff.value;
    
    if (oldValue !== newValue) {
        console.log(`💕 好感度 ${oldValue} → ${newValue} (${reason})`);
        
        // 阈值突破触发对话
        if (oldValue < 20 && newValue >= 20) {
            setTimeout(() => {
                if (window.CHAT) window.CHAT.talkToOllama(
                    '（你对主人的好感度从“讨厌”升到了“接受”。请用1-2句傲娇的话表达你开始有点习惯他，只输出话语。）',

                    { skipLearning: true }

                );
            }, 1500);
        } else if (oldValue < 80 && newValue >= 80) {
            setTimeout(() => {
                if (window.CHAT) window.CHAT.talkToOllama(
                    '（你对主人的好感度从“喜欢”升到了“依赖”。请用1-2句傲娇又粘人的话，表达离不开他，只输出话语。）',

                    { skipLearning: true }
                );
            }, 1500);
        } else if (oldValue >= 50 && newValue < 50) {
            setTimeout(() => {
                if (window.CHAT) window.CHAT.talkToOllama(
                    '（你对主人的好感度从“喜欢”降回“接受”。请用1-2句傲娇但带点失望的话，只输出话语。）',
                    
                    { skipLearning: true }
                );
            }, 1500);
        }
    }
    
    window.STORAGE.saveLearning();
}

function getAffectionPhase() {
    const data = window.STORAGE.getLearningData();
    const value = data.affection?.value ?? 50;
    if (value <= 20) return '讨厌';
    if (value <= 50) return '接受';
    if (value <= 80) return '喜欢';
    return '依赖';
}

function getAffectionValue() {
    const data = window.STORAGE.getLearningData();
    return data.affection?.value ?? 50;
}

window.AFFECTION = {
    change: changeAffection,
    getPhase: getAffectionPhase,
    getValue: getAffectionValue
};