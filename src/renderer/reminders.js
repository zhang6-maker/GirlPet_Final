// ==================== 提醒模块 ====================
// 依赖: window.DEPENDENCIES, window.UI, window.TTS

const REMINDER_FILE = window.DEPENDENCIES.path.join(
    window.DEPENDENCIES.os.homedir(),
    '.girlpet_reminders.json'
);

let reminderCheckInterval = null;

function loadReminders() {
    try {
        if (window.DEPENDENCIES.fs.existsSync(REMINDER_FILE)) {
            const data = window.DEPENDENCIES.fs.readFileSync(REMINDER_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('⚠️ 加载提醒失败:', e);
    }
    return [];
}

function saveReminders(reminders) {
    try {
        window.DEPENDENCIES.fs.writeFileSync(REMINDER_FILE, JSON.stringify(reminders, null, 2), 'utf8');
    } catch (e) {
        console.error('⚠️ 保存提醒失败:', e);
    }
}

function addReminder(triggerTime, content) {
    const reminders = loadReminders();
    reminders.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
        time: triggerTime,
        content: content,
        fired: false
    });
    saveReminders(reminders);
    console.log(`⏰ 已添加提醒: [${new Date(triggerTime).toLocaleString()}] ${content}`);
}

function checkReminders() {
    const now = Date.now();
    const reminders = loadReminders();
    let changed = false;

    for (let r of reminders) {
        if (!r.fired && r.time <= now) {
            // ========== 如果在睡觉，执行完整苏醒动画 ==========
            if (window.STATE && window.STATE.state === 'sleeping') {
                // 1. 进入苏醒状态，显示 waking.gif
                window.STATE.setState('waking');
                window.UI.showBubble('⏰ 有提醒啦，该起床了~', 2000, 'neutral', false);

                // 2. 2.5 秒后切换到伸懒腰，显示 stretch.gif
                setTimeout(() => {
                    if (window.STATE.state === 'waking') {
                        window.STATE.setState('stretching');
                    }
                }, 4000);

                // 3. 4.5 秒后恢复 idle，重置冷却并启动空闲/玩耍计时器
                setTimeout(() => {
                    if (window.STATE.state === 'stretching') {
                        window.STATE.setState('idle');
                        // 重置自动休眠冷却，防止醒来后立刻又被自动去睡觉
                        if (window.STATE.resetAutoActionTime) {
                            window.STATE.resetAutoActionTime();
                        }
                        window.STATE.startIdleTimer();
                        window.STATE.startRandomPlay();
                    }
                }, 7000);
            }

            // ========== 标记提醒已触发，并稍后弹出提醒文字 ==========
            r.fired = true;
            changed = true;

            // 延迟 1 秒弹出提醒，避免与苏醒气泡冲突
            setTimeout(() => {
                window.UI.showBubble(`⏰ 提醒：${r.content}`, 8000, 'neutral', false);
                window.TTS.speak(r.content || '您有一条提醒');
                console.log(`🔔 触发提醒: ${r.content}`);
            }, 2000);
        }
    }

    if (changed) {
        saveReminders(reminders);
    }
}

function startReminderCheck() {
    if (reminderCheckInterval) return;
    // 每秒检查一次（轻量操作，不会影响性能）
    reminderCheckInterval = setInterval(checkReminders, 1000);
    checkReminders(); // 启动时立即检查一次，避免错过
    console.log('⏰ 提醒检查已启动');
}

// 导出模块
window.REMINDERS = {
    addReminder,
    loadReminders,
    startReminderCheck,
    // 可选：获取未完成的提醒列表
    getPending: () => loadReminders().filter(r => !r.fired)
};