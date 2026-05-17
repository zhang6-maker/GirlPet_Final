🐣 寻慧 - 桌面小精灵
一个会傲娇、会毒舌、会在你桌面上自由生活的 AI 养成伙伴。

寻慧是一个基于 Electron 开发的桌面虚拟宠物。她拥有生动的 GIF 动画、AI 对话能力（通过 Ollama）、语音合成（Edge TTS 或浏览器降级）、丰富的自主行为（工作、睡觉、玩耍），还能陪你下棋、唱歌、写日记、生成 PPT…… 她是你在电脑桌面上最吵、最烦、也最可爱的“小跟班”。

✨ 功能清单
🧠 AI 对话与人格
接入本地 Ollama 大模型，默认 qwen2:7b，完全离线可用。
内置毒舌傲娇系统提示词，每个回复都带刺儿，但偷偷关心你。
支持用户画像记忆：记住你的性别、恋爱状态、生日，节日或生日时会主动祝福。
🕺 丰富动作与状态
自动起床/睡觉（可自定义时间）
工作、玩耍、喂食（含拖拽投食）、跳舞、伸懒腰、唱歌、报时
所有动作都有配套角色动画和气泡反馈
🎲 内置小游戏
五子棋、跳棋（独立窗口），支持胜负反馈
📒 日记本
自动记录与你互动的每一天，支持翻页查看
📱 手机遥控
启动后自动生成手机遥控页面，扫码即可远程喂食、命令
🔊 语音功能
语音合成（Edge TTS 优先，浏览器 SpeechSynthesis 降级）
语音识别（Vosk 离线识别，需附加模型）
📊 实用工具
智能搜索（百度）
PPT 生成（从零生成或基于模板，需 PowerPoint 环境）
模板记忆与 AI 选用
🎨 个性化细节
拖拽角色自由摆放
隐身模式（窗口缩小为右下角小按钮，快捷键 Ctrl+Shift+H 强制唤回）
毒舌变脸（AI 回复中带有特定关键词时自动更换嫌弃表情）
🛠 技术栈
层级	技术
桌面框架	Electron
前端渲染	HTML5 + CSS3 + Vanilla JS
AI 引擎	Ollama (本地大模型)
语音合成	Edge TTS (Python FastAPI)
语音识别	Vosk (Python 脚本)
文件处理	Python (python‑pptx, Pillow 等)
构建	electron‑builder
🚀 快速开始
环境要求
Windows 系统（目前仅在 Windows 测试）
Node.js >= 16
Python 3.10+ （并安装以下库：fastapi, uvicorn, edge-tts, vosk, numpy）
Ollama 并下载至少一个中文模型（推荐 qwen2:7b）
PowerPoint（仅 PPT 模板分析功能需要，普通使用可忽略）
安装步骤
# 1. 克隆或下载本项目到本地
git clone <你的仓库地址>
cd girlpet

# 2. 安装 Node 依赖
npm install

# 3. （可选）安装 Python 依赖
pip install fastapi uvicorn edge-tts vosk numpy

# 4. （可选，语音识别）下载 Vosk 中文模型到 bin/vosk-model-cn-0.22
#    下载地址：https://alphacephei.com/vosk/models

# 5. 启动前确保 Ollama 已在后台运行，并已拉取模型
ollama pull qwen2:7b

# 6. 启动应用
npm start
首次启动常见问题
TTS 服务启动失败：检查 Python 和依赖是否安装完整，或手动运行 python edge_tts_service.py 排查错误。
AI 对话无响应：检查 Ollama 是否已启动，端口是否为 11434，模型名是否匹配。
PPT 模板分析失败：确保电脑安装了 PowerPoint 且路径可被调用（此功能非必须，不影响基础使用）。
⚙️ 配置说明
点击桌面宠物右上角的气泡打开输入框，输入“打开设置”或点击齿轮⚙️图标，可修改：

Ollama 地址/模型
TTS 地址/发音人
自动睡觉/起床时间
设置会保存在用户目录下的 .girlpet_settings.json，重启生效。

📁 项目结构
girlpet/
├── main.js                # Electron 主进程
├── index.html             # 主窗口界面
├── package.json           # Node 依赖与构建配置
├── src/renderer/          # 渲染进程核心模块（见下方说明）
├── gomoku.html + gomoku.js    # 五子棋窗口
├── checkers.html + checkers.js # 跳棋窗口
├── edge_tts_service.py    # TTS 服务（Python）
├── vosk_stt.py            # 语音识别脚本
├── fill_ppt.py            # PPT 填充脚本
├── ...                    # 其他辅助脚本
└── images/                # 角色动画图片
渲染进程模块说明（src/renderer/）：

deps.js - 统一管理 Node 依赖与 DOM 元素缓存
config.js - 配置常量（图像路径、状态时长等）
state.js - 角色状态机与定时器
actions.js - 动作指令与用户意图识别
chat.js - AI 对话、用户画像分析、时间解析
ui.js - 气泡、输入框、内心戏等 UI 组件
tts.js - 语音合成队列管理
voice.js - 语音输入与格式转换
storage.js - 本地文件存储（日记、歌词、学习记录）
drag.js - 拖拽喂食与人物拖拽
game.js - 游戏结果反馈
reminders.js - 提醒定时任务
index.js - 初始化入口
🧪 测试与调试
需要查看角色状态日志：打开开发者工具（可在 main.js 中取消 webContents.openDevTools() 注释）。
模拟用户指令：通过手机遥控页面或直接在对话框输入。
注意角色有最小状态持续时间（默认 10 分钟），防止频繁切换导致闪烁。
🦊 PPT 功能问题
保存或制作PPT时播放work.gif动画
涉及文件：PPT 生成相关的渲染进程代码（可能位于 ppt.js 或 actions.js 的 PPT 分支）。
具体现象：调用生成 PPT 接口后，界面上的 work.gif 停止播放或显示空白帧。
根因分析：
work.gif 的 <img> 或 Canvas 绘制在同步操作（如文件写入、模板填充）期间被阻塞，主线程无法更新动画帧。
可能 GIF 路径解引用错误，导致资源加载失败但不报错。
修复思路：
将耗时操作（如 python-pptx 子进程调用）改为异步执行并监听完成事件，期间保持动画循环。
检查 GIF 路径是否为相对路径且正确指向 resources/ 目录。
如果用 Canvas 绘制，确保 requestAnimationFrame 循环未被同步代码打断。
🛏️ 宠物睡觉/唤醒 Bug
goToBed 前置检查分析
涉及文件：actions.js 中的 goToBed 函数。
具体现象：宠物睡眠过程出现状态跳跃（如直接进入深睡而跳过躺下动画），或睡眠期间仍可触发其他动作。
根因分析：

goToBed 缺少对当前状态的互斥检查（如“已在睡眠中”或“正在执行其他不可中断动作”）。
可能多个定时器/事件同时调用 goToBed，造成状态覆盖。
修复思路：
在函数入口添加状态守卫：if (state.status === 'sleeping' || state.status === 'goingToBed') return;
使用状态锁，在进入睡眠流程时设置 state.sleepLock = true，流程结束后释放。
“睡了醒、醒了睡”循环原因
涉及文件：state.js 的自动睡眠判定逻辑 + actions.js 的唤醒函数。
具体现象：手动唤醒宠物（如点击“起床”），几秒后又自动进入睡眠，无限循环。
根因分析：

state.js 中有一个 lastInteractionTime 时间戳用于判断“多久无操作就睡觉”。
手动唤醒时只更新了 UI 状态，但没有重置 lastInteractionTime，导致下一次定时器检查时立刻判定超时，再次触发睡眠。
另外“唤醒宽限期”逻辑可能只在 waking→idle 过渡时生效，若用户执行了其他动作（如直接玩耍），宽限期被跳过。
修复思路：
在唤醒操作的最后显式执行 state.lastInteractionTime = Date.now();
将宽限期保护改为一个独立的标志位 state.wakeProtectionUntil，在唤醒后任意状态切换时都检查此标志位。
🧹 actions.js 代码质量问题
未定义变量与重复声明分析
涉及文件：actions.js。
具体现象：控制台报 Uncaught ReferenceError: xxx is not defined 或 SyntaxError: Identifier 'yyy' has already been declared。
根因位置举例：
可能存在 if (condition) { let task = ... } 之后在外部使用 task，导致未定义。
可能顶部用 var task 声明，内部又 let task 重复声明。
修复思路：
全局搜索这些变量名，统一作用域（提升为函数级 let 或模块常量）。
删除多余声明，或改用不同变量名避免冲突。
🔧 代码优化建议
代码优化（方向1）
侧重：模块化与全局变量治理。
具体问题：window 对象上挂载了过多模块（如 window.chat, window.actions），导致耦合度高、测试困难。
优化建议：

采用 ES6 模块（import/export）或至少用 IIFE 封装，通过统一的事件总线通信。
将宠物行为拆分为独立的状态机模块，每个模块只暴露 start()/stop()。
代码优化（方向2）
侧重：性能与内存管理。
具体问题：

多个 setInterval / requestAnimationFrame 在状态切换时未清理，导致后台累积运行。
部分 DOM 节点移除后关联的事件监听器未解绑，造成内存泄漏。
优化建议：
建立全局 animationManager，统一管理所有动画 ID，切换状态时调用 cancelAll() 清除。
对长期存在的 DOM 使用事件委托，或在组件销毁前显式 removeEventListener。
⚠️ 关键崩溃与安全漏洞
Critical 级问题汇总
涉及文件：main.js、package.json、config 相关文件。
具体现象：
启动即闪退，终端报 TypeError: Cannot read property 'getPath' of undefined。
潜在 XSS 攻击面：渲染进程可以执行任意系统命令。
根因分析：
在 main.js 顶层直接执行 const userDataPath = app.getPath('userData');，此时 app 尚未就绪。
webPreferences 中 nodeIntegration: true 且 contextIsolation: false，恶意脚本可通过 require('child_process') 执行系统命令。
修复思路：
移动 getPath 调用至 app.whenReady().then(() => { ... }) 内部。
开启 contextIsolation: true，通过 preload.js 使用 contextBridge.exposeInMainWorld 暴露有限的 API。
对用户输入进行 XSS 过滤，禁用 <webview> 等危险标签。
📋 项目整体评估（按视角细分）
架构、代码质量、安全性与可维护性
盘点全局变量污染、模块循环依赖、缺少分层（渲染/主进程职责混在一起）、日志缺失等问题。

代码质量、架构与安全风险
重点指出硬编码路径（Python 脚本位置、模型目录）、同步操作阻塞 UI、异常处理缺失等隐患。

设计缺陷、潜在Bug与安全风险
暴露状态机设计漏洞（缺少完整状态转换图）、定时器泄漏、Electron 安全配置不当三大类。

长期维护视角的综合评估
分析技术债：如果持续迭代，代码的高耦合将成为最大障碍；推荐引入 TypeScript、自动化测试等。

🤝 贡献指南
欢迎提交 Issue 与 Pull Request！在修改代码前，请注意：

保持模块化，每个 .js 文件职责清晰。
新增功能尽量独立于已有动作系统，避免过多耦合。
如果想让 AI 更“聪明”，可以微调 chat.js 中的系统提示词。
本项目使用 window 全局对象进行模块通信，若想改为 ES Module 或其他方式，请统一修改并测试所有引用。
📝 TODO / 已知改进点
 将 Python 脚本与便携环境打包更完整，降低使用者门槛。
 优化提示词与意图分类，减少“反话”误触发（已部分优化）。
 提高安全性：游戏窗口启用 contextIsolation。
 自动检测桌面路径（目前部分硬编码 Desktop）。
 清理未使用的 npm 依赖。
❤️ 致谢
寻慧的灵感源于对“长久陪伴”的渴望。
希望这个吵吵闹闹的小家伙能陪你度过每一个赶工、摸鱼或孤独的深夜。
“哼，我才不是特意在这里等你呢…”
