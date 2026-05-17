// ==================== 拖拽模块 ====================
// 依赖: window.CONFIG, window.STATE, window.UI, window.ACTIONS, window.DEPENDENCIES

let isDraggingGirl = false;
let dragStartX = 0, dragStartY = 0, girlStartLeft = 0, girlStartTop = 0;
let hungerTimer = null;
let foodIcon = null;

// ==================== 人物拖拽 ====================
function initGirlDrag() {
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;
    
    girl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDraggingGirl = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        girlStartLeft = window.STATE.currentX;
        girlStartTop = window.STATE.currentY;
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
        window.STATE.currentX = newLeft;
        window.STATE.currentY = newTop;
        window.STATE.targetX = newLeft;
        window.STATE.targetY = newTop;
        window.STATE.updatePosition();
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingGirl) {
            isDraggingGirl = false;
            girl.style.cursor = 'pointer';
        }
    });
}

// ==================== 食物图标 ====================
function showFoodIcon() {
    if (!foodIcon) foodIcon = document.getElementById('foodIcon');
    if (!foodIcon) return;
    const foods = window.CONFIG.FOOD_ICONS;
    foodIcon.innerText = foods[Math.floor(Math.random() * foods.length)];
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;
    const girlRect = girl.getBoundingClientRect();
    let left = girlRect.left + 40 + (Math.random() * 60 - 30);
    let top = girlRect.top - 40 + (Math.random() * 40);
    left = Math.min(Math.max(left, 10), window.innerWidth - 60);
    top = Math.min(Math.max(top, 10), window.innerHeight - 60);
    foodIcon.style.left = left + 'px';
    foodIcon.style.top = top + 'px';
    foodIcon.style.display = 'flex';
    setTimeout(() => {
        if (foodIcon.style.display === 'flex') {
            foodIcon.style.display = 'none';
            const timeoutBubbles = [
                '你是手残吗？连拖个食物都不会？',
                '食物要消失了！你是不是故意的？',
                '我真服了，这么简单的操作你都磨叽……',
                '我记住你了，等我饿死变鬼天天烦你！'
            ];
            const msg = timeoutBubbles[Math.floor(Math.random() * timeoutBubbles.length)];
            window.UI.showBubble(msg, 2000);
            setTimeout(startHungerTimer, 5000);
        }
    }, 20000);
}

function hideFoodIcon() {
    if (foodIcon) foodIcon.style.display = 'none';
}

function onFeedByDrag() {
    hideFoodIcon();
    window.ACTIONS.feed();
    // 再加一句短暂的毒舌气泡
    setTimeout(() => {
        window.UI.showBubble('居然真的喂了……你不会是喜欢我吧？', 1500);
    }, 500);
    if (hungerTimer) clearTimeout(hungerTimer);
    startHungerTimer();
}

function startHungerTimer() {
    if (hungerTimer) clearTimeout(hungerTimer);
    const min = 300000; // 5 分钟
    const max = 600000; // 10 分钟
    const delay = min + Math.random() * (max - min);
    hungerTimer = setTimeout(() => {
        if (window.STATE.state !== 'sleeping' && !window.STATE.isSpeaking) {
            const hungryBubbles = [
                '喂！你是想饿死我吗？快投食！',
                '本小姐的肚子在抗议了，你耳朵聋了吗？',
                '再不喂我，我就把你桌面的文件全删了！',
                '饿死了饿死了！你这个不合格的铲屎官！',
                '看什么看？没见我快饿扁了吗？动动你的小胖手！'
            ];
            const msg = hungryBubbles[Math.floor(Math.random() * hungryBubbles.length)];
            window.UI.showBubble(msg, 3000);
            showFoodIcon();
        } else {
            startHungerTimer();
        }
    }, delay);
}

// ==================== 拖拽喂食初始化 ====================
function initDragDrop() {
    foodIcon = document.getElementById('foodIcon');
    if (!foodIcon) return;
    const girl = window.DEPENDENCIES.girl;
    if (!girl) return;
    girl.setAttribute('dropzone', 'move');
    girl.addEventListener('dragover', (e) => e.preventDefault());
    girl.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.getData('text/plain') === 'food') onFeedByDrag();
    });
    foodIcon.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'food');
        e.dataTransfer.effectAllowed = 'copy';
        foodIcon.style.opacity = '0.6';
    });
    foodIcon.addEventListener('dragend', () => foodIcon.style.opacity = '1');
}

// 导出拖拽模块
window.DRAG = {
    initGirlDrag,
    initDragDrop,
    showFoodIcon,
    hideFoodIcon,
    startHungerTimer,
    stopHungerTimer: () => {        // ✅ 新增
        if (hungerTimer) {
            clearTimeout(hungerTimer);
            hungerTimer = null;
        }
    }
};