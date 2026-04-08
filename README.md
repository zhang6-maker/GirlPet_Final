# 🐣 寻慧桌面宠物 – 会唱歌、下棋、写日记的 AI 小女孩

[![GitHub stars](https://img.shields.io/github/stars/zhang6-maker/GirlPet_Final?style=social)](https://github.com/zhang6-maker/GirlPet_Final/stargazers)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 一个**完全离线**、**可语音交互**、**能学习记忆**的桌面小精灵。  
> 她可以陪你聊天、下五子棋/跳棋、写日记、生成 PPT，还会主动要吃的、唱歌、按时睡觉……

![demo](./demo.gif)  <!-- 如果你有演示动图，可以替换这个路径 -->

---

## ⚠️ 常见坑与解决方案（必看！）

在开始之前，请先了解这些你可能遇到的坑，可以节省大量时间：

| 坑 | 现象 | 解决方案 |
|----|------|----------|
| **Electron 安装失败** | `RequestError: unable to verify the first certificate` 或下载极慢 | 设置环境变量：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 并关闭 SSL 验证：`NODE_TLS_REJECT_UNAUTHORIZED=0` |
| **Ollama 服务未启动** | 对话时提示“连接失败” | 先运行 `ollama serve` 或双击桌面 Ollama 图标，确保任务栏有图标 |
| **模型未下载** | 对话返回 `model 'qwen2:7b' not found` | 执行 `ollama pull qwen2:7b`（约 4GB）或改用小模型 `tinyllama` |
| **语音识别没反应** | 点击麦克风后无提示或报错 `not-allowed` | 检查系统麦克风权限，在浏览器/Electron 中允许麦克风；确保网络通畅（Web Speech API 需要联网） |
| **图片无法显示** | 小女孩区域空白或显示“裂图” | 检查 `images/` 文件夹中的 GIF 文件名是否与代码中一致（`idle.gif`, `walk.gif`, `work.gif`…） |
| **棋盘显示不全** | 跳棋棋盘超出屏幕 | 代码已调整为 360x360 并支持滚动，如果仍然超出，可以拖动棋盘标题栏移动位置 |
| **定时睡觉不生效** | 到了22点不自动睡觉 | 确保电脑系统时间正确，且小女孩处于 `idle` 状态（没有在走路/工作/玩耍） |

---

## 🚀 完整运行过程（从零开始）

### 第一步：克隆代码
```bash
git clone https://github.com/zhang6-maker/GirlPet_Final.git
cd GirlPet_Final
```

### 第二步：安装 Node.js 依赖（关键！国内用户必看）
```bash
# 设置国内镜像（解决 Electron 下载慢）
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:NODE_TLS_REJECT_UNAUTHORIZED = 0   # 临时关闭 SSL 证书验证（仅用于下载）

# 安装所有依赖
npm install
```
> **如果安装过程中卡在 `node install.js`**，可以尝试使用 `yarn`：
> ```bash
> npm install -g yarn
> yarn config set electron_mirror https://npmmirror.com/mirrors/electron/
> yarn install
> ```

### 第三步：安装并配置 Ollama（用于智能对话）
1. 访问 [ollama.com](https://ollama.com) 下载并安装。
2. 打开命令行，拉取模型（二选一）：
   ```bash
   ollama pull qwen2:7b      # 推荐，效果更好（4GB）
   # 或
   ollama pull tinyllama      # 轻量级（600MB）
   ```
   当然你选择其他的AI模型也可以，可以直接问AI怎么改代码
3. 确保 Ollama 在后台运行（系统托盘有图标，或执行 `ollama serve` 后保持窗口不关闭）。

### 第四步：准备动画素材（GIF）
在项目根目录下创建 `images` 文件夹，放入以下 8 个 GIF 文件（文件名必须完全一致）：
- `idle.gif` – 待机动画
- `walk.gif` – 走路动画
- `work.gif` – 工作动画
- `sleep.gif` – 睡觉动画
- `play.gif` – 玩耍动画1
- `play2.gif` – 玩耍动画2（滑板）
- `eat.gif` – 吃东西动画
- `wake.gif` – 醒来动画

> 如果没有现成的 GIF，可以用任意图片临时改名代替，但动画效果会缺失。

### 第五步：启动桌宠
```bash
npm start
```
桌宠窗口会出现在屏幕右下角，点击她即可开始互动。

### 第六步：手机遥控（可选）
- 确保手机和电脑连接同一 Wi-Fi。
- 查看电脑的局域网 IP（PowerShell 输入 `ipconfig`，找 IPv4 地址）。
- 手机浏览器访问 `http://电脑IP:8080`。
- 点击按钮即可远程控制。

---

## 🎮 常用指令（在电脑输入框中输入）

| 你想让她… | 可以说… |
|-----------|----------|
| 工作 | `工作` |
| 睡觉 | `睡觉` |
| 玩耍 | `玩` |
| 喂食 | `喂食` 或 `吃`（也可以拖拽出现的食物图标） |
| 下五子棋 | `五子棋` |
| 下跳棋 | `跳棋` |
| 查看日记 | `查看日记` 或 `看日记` |
| 写 PPT | `写PPT 关于猫咪` |
| 唱歌 | `唱 小星星`（需要先教） |
| 教唱歌 | `教我唱 小星星 一闪一闪亮晶晶...` |
| 报时 | `几点了` |
| 搜索 | `搜索 天气` |

---

## 🛠️ 自定义与配置

- **修改自动睡觉/起床时间**：编辑 `renderer.js` 中的 `sleepTime` 和 `wakeTime`。
- **更换语音**：修改 `speak` 函数中的 `utterance.rate`（语速）和 `pitch`（音调），以及 `voices.find` 筛选条件。
- **增加玩耍音效**：在 `play` 函数的 `actions` 数组里添加 `{ text: '🎉 哇', sound: '哇' }`。
- **更改日记称呼**：修改 `autoDiary` 函数中的 `userName` 变量（例如改成“小伙伴”）。
- **关闭自动玩耍**：注释掉 `startRandomPlay()` 的调用即可。

---

## 📂 文件结构

```
GirlPet_Final/
├── main.js               # Electron 主进程
├── renderer.js           # 所有核心逻辑（1300+ 行）
├── index.html            # 主界面
├── mobile.html           # 手机遥控页面
├── package.json          # 依赖清单
├── .gitignore            # 忽略 node_modules 等
├── README.md             # 本文件
└── images/               # GIF 动画
```

---

## 🤝 已知问题 & 未来计划

### 已知问题（欢迎帮助改进）
- 语音识别常常不稳定（依赖网络和浏览器），建议作为辅助输入方式。
- 跳棋 AI 强度不明（因为作者自己也不会玩😅），期待跳棋高手优化。
- 手机遥控未经过充分测试，可能因网络环境需要重连。
- 长文本气泡虽然加了滚动条，但偶尔仍会超出屏幕（可通过拖动小女孩位置解决）。
- ppt生成目前只能生成几行字
- 日记比较简陋

### 计划中的功能
- [ ] 更多的随机玩耍动作和音效
- [ ] 自定义皮肤/换装
- [ ] 支持更多棋类游戏（国际象棋、军棋）
- [ ] 导出日记为 Markdown 或 PDF
- [ ] 完全离线的语音识别（使用 Vosk）

---

## 📜 许可证

MIT License – 可以自由使用、修改、分享，但请保留原作者声明。

---

## 🙏 致谢

- [Electron](https://www.electronjs.org/) – 跨平台桌面框架
- [Ollama](https://ollama.com/) – 本地大语言模型
- [pptxgenjs](https://github.com/gitbrent/PptxGenJS) – 生成 PPT
- 以及所有开源社区的朋友们

---

**如果这个项目让你开心了一小会儿，请给它一颗 ⭐ 吧～**  
有建议或问题欢迎提 [Issue](https://github.com/zhang6-maker/GirlPet_Final/issues) 或 Pull Request。
```

---

