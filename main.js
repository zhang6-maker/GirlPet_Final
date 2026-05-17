const { shell } = require('electron'); // 直接 require Electron 的 shell 和 os 模块

const { app, BrowserWindow, screen, ipcMain, globalShortcut, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const fetch = require('node-fetch'); // 确保已 npm install node-fetch

let win;
let wss = null;
let gomokuWindow = null;
let checkersWindow = null;
let ttsProcess = null;

let userDataPath;
let templatesRoot;

// ==================== 启动 Edge‑TTS 服务 ====================
function startTTSService() {
    const isPackaged = app.isPackaged;
    let pythonExe, scriptPath;

    if (isPackaged) {
        pythonExe = path.join(process.resourcesPath, 'python_portable', 'python.exe');
        scriptPath = path.join(process.resourcesPath, 'edge_tts_service.py');
    } else {
        pythonExe = path.join(__dirname, 'python_portable', 'python.exe');
        scriptPath = path.join(__dirname, 'edge_tts_service.py');
    }

    console.log('🚀 正在启动 Edge‑TTS 服务...');
    console.log('Python 路径:', pythonExe);
    console.log('脚本路径:', scriptPath);

    if (!fs.existsSync(pythonExe)) {
        console.error('❌ Python 解释器不存在:', pythonExe);
        return;
    }
    if (!fs.existsSync(scriptPath)) {
        console.error('❌ TTS 脚本不存在:', scriptPath);
        return;
    }

    // 在 main.js 的 startTTSService 函数里，spawn 启动之后
    ttsProcess = spawn(pythonExe, [scriptPath], {
        windowsHide: true  // 隐藏黑色窗口
    });
    
    // 新增：等待 TTS 服务就绪
    let attempts = 0;
    const maxAttempts = 10; // 最多等 10 次
    const checkInterval = setInterval(async () => {
        attempts++;
        try {
            const response = await fetch('http://127.0.0.1:8001/synthesize/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: 'test', voice: 'zh-CN-XiaoyiNeural' }),
                signal: AbortSignal.timeout(2000)
            });
            if (response.ok) {
                console.log('✅ TTS 服务就绪');
                clearInterval(checkInterval);
            }
        } catch (e) {
            if (attempts >= maxAttempts) {
                console.error('❌ TTS 服务启动超时');
                clearInterval(checkInterval);
            }
        }
    }, 1000); // 每秒检查一次

    ttsProcess.stdout.on('data', (data) => {
        console.log(`[TTS] ${data}`);
    });

    ttsProcess.stderr.on('data', (data) => {
        console.error(`[TTS 错误] ${data}`);
    });

    ttsProcess.on('close', (code) => {
        console.log(`[TTS] 进程退出，代码 ${code}`);
    });

    ttsProcess.on('error', (err) => {
        console.error('启动 TTS 服务失败:', err);
    });
}

// ==================== 自动启动音乐API服务（NeteaseCloudMusicApi） ====================
let musicApiProcess = null;

function startMusicApiService() {
    // 音乐服务目录：假设放在项目父目录下的 NeteaseCloudMusicApi
    const apiDir = path.join(__dirname, '..', 'NeteaseCloudMusicApi');
    const apiEntry = path.join(apiDir, 'app.js');   // 入口文件

    if (!fs.existsSync(apiEntry)) {
        console.warn('⚠️ 未找到音乐API服务，请将 NeteaseCloudMusicApi 放在项目父目录下，或修改路径');
        return;
    }

    console.log('🎵 正在启动音乐API服务...');
    musicApiProcess = spawn('node', [apiEntry], {
        cwd: apiDir,
        stdio: 'ignore',           // 不输出日志，若需调试可改为 'pipe'
        detached: false,
        windowsHide: true          // 隐藏窗口（Windows）
    });

    musicApiProcess.on('error', (err) => {
        console.error('❌ 音乐API服务启动失败:', err);
        musicApiProcess = null;
    });

    musicApiProcess.on('exit', (code) => {
        console.log(`🎵 音乐API服务已退出，代码 ${code}`);
        musicApiProcess = null;
    });

    // 轮询检测服务是否就绪（最多等待10秒）
    let attempts = 0;
    const checkInterval = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch('http://localhost:3000/search?keywords=test&limit=1');
            if (res.ok) {
                console.log('✅ 音乐API服务就绪');
                clearInterval(checkInterval);
            } else if (attempts >= 10) {
                console.warn('⚠️ 音乐API服务启动超时，请检查');
                clearInterval(checkInterval);
            }
        } catch (e) {
            if (attempts >= 10) {
                console.warn('⚠️ 音乐API服务启动超时，请检查');
                clearInterval(checkInterval);
            }
        }
    }, 1000);
}

// ==================== 创建主窗口 ====================
 function createWindow() {
     const { width, height } = screen.getPrimaryDisplay().workAreaSize;
     const winWidth = 400;
     const winHeight = 500;
 
     win = new BrowserWindow({
         width: winWidth,
         height: winHeight,
         transparent: true,
         frame: false,
         alwaysOnTop: true,
         resizable: false,
         skipTaskbar: true,
         title: '寻慧 - 桌面小精灵',
 
        // webPreferences: {
        //     nodeIntegration: true,
        //     contextIsolation: false
        // }

        webPreferences: {
            // ✅ 启用上下文隔离（主进程与渲染进程 JS 环境完全隔开）
            contextIsolation: true,
            // ✅ 禁用 Node.js 集成（渲染进程无法直接 require 系统模块）
            nodeIntegration: false,

            sandbox: false,

            // ✅ 指定预加载脚本（只能通过它暴露有限的 API 给渲染进程）
            preload: path.join(__dirname, 'preload.js')
            }
     });
 
     win.loadFile('index.html');
     win.setPosition(width - winWidth, height - winHeight);
     // win.webContents.openDevTools();  // 调试时可取消注释
 
     win.on('closed', () => { win = null; });
 }

// ==================== HTTP 服务（手机遥控页面） ====================
function createHttpServer() {
    const server = http.createServer((req, res) => {
        if (req.url === '/') {
            fs.readFile(path.join(__dirname, 'mobile.html'), (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        } else if (req.url === '/ip') {
            //const os = require('os');
            const interfaces = os.networkInterfaces();
            let ip = '127.0.0.1';
            for (let name in interfaces) {
                for (let iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        ip = iface.address;
                        break;
                    }
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ip }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    server.listen(8080, '0.0.0.0', () => {
        console.log('✅ HTTP 服务已启动，端口 8080');
    });
}

// ==================== WebSocket 服务（手机通信） ====================
function createWebSocketServer() {
    wss = new WebSocket.Server({ port: 8083 });
    wss.on('connection', (ws) => {
        console.log('📱 手机已连接');
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (win) win.webContents.send('mobile-command', data);
            } catch (e) {}
        });
        ws.on('close', () => console.log('📱 手机断开连接'));
    });
    console.log('✅ WebSocket 服务已启动，端口 8083');
}

ipcMain.on('reply-to-mobile', (event, reply) => {
    if (wss) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'reply', text: reply }));
            }
        });
    }
});

// ==================== 五子棋窗口 ====================
function createGomokuWindow() {
    if (gomokuWindow) {
        gomokuWindow.focus();
        return;
    }

    gomokuWindow = new BrowserWindow({
        width: 340,
        height: 400,
        resizable: false,
        alwaysOnTop: false,
        frame: true,
        title: '五子棋',
        webPreferences: {
            contextIsolation: true,     // 启用上下文隔离
            nodeIntegration: false,     // 禁用 Node 集成

            sandbox: false,

            preload: path.join(__dirname, 'preload.js')   // 复用同一个 preload，确保游戏窗口也能使用暴露的 API

        }
    });

    gomokuWindow.loadFile('gomoku.html');

    gomokuWindow.on('closed', () => {
        gomokuWindow = null;
    });

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    gomokuWindow.setPosition(Math.floor((width - 340) / 2), Math.floor((height - 400) / 2));
}

// ==================== 跳棋窗口 ====================
function createCheckersWindow() {
    if (checkersWindow) {
        checkersWindow.focus();
        return;
    }

    checkersWindow = new BrowserWindow({
        width: 400,
        height: 460,
        resizable: false,
        alwaysOnTop: false,
        frame: true,
        title: '跳棋',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,

            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    checkersWindow.loadFile('checkers.html');

    checkersWindow.on('closed', () => {
        checkersWindow = null;
    });

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    checkersWindow.setPosition(Math.floor((width - 400) / 2), Math.floor((height - 460) / 2));
}

// ==================== Vosk 语音识别（通过 Python 脚本） ====================
// 获取 Python 解释器路径（使用系统 Python，因为已安装 vosk 和 soundfile）
function getPythonExe() {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
        return path.join(process.resourcesPath, 'python_portable', 'python.exe');
    } else {
        return path.join(__dirname, 'python_portable', 'python.exe');
    }
}

// ========== 新增：提取模板文本（调用 Python） ==========
function extractTemplateText(templatePath) {
    return new Promise((resolve, reject) => {
        const pythonExe = getPythonExe();
        const scriptPath = path.join(__dirname, 'extract_ppt_text.py');
        console.log('🔧 调用 PowerPoint 分析模板...');
        exec(`"${pythonExe}" "${scriptPath}" "${templatePath}"`, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                console.error('提取模板信息失败:', stderr);
                reject(err);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// ========== 新增：用 Ollama 分析模板风格 ==========
async function analyzeTemplateContent(text, ollamaUrl = 'http://localhost:11434') {
    // 使用传入的 ollamaUrl，如果未传或为空则回退到默认值
    const url = ollamaUrl || 'http://localhost:11434';
    
    const prompt = `请根据以下PPT模板的文字内容、字体颜色、整体主色调（从内嵌图片分析），用一句简短中文描述该模板的风格和适用场景。注意：如果主色调包含深色（如#000000、#060709等），且字体为白色，则很可能是深色背景模板。信息：\n${text}`;
    
    try {
        const response = await fetch(`${url}/api/generate`, {
            method: 'POST',
            body: JSON.stringify({ model: 'qwen2:7b', prompt, stream: false })
        });
        const data = await response.json();
        return data.response.replace(/[\n\r]/g, '').trim();
    } catch (e) {
        return "通用模板";
    }
}

// 获取 Vosk 脚本路径（适配开发和打包环境）
function getVoskScript() {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
        return path.join(process.resourcesPath, 'vosk_stt.py');
    } else {
        return path.join(__dirname, 'vosk_stt.py');
    }
}

ipcMain.handle('transcribe-audio', async (event, audioFilePath) => {
    return new Promise((resolve, reject) => {
        const pythonExe = getPythonExe();
        const scriptPath = getVoskScript();

        if (!fs.existsSync(scriptPath)) {
            reject(new Error(`Vosk 脚本未找到: ${scriptPath}`));
            return;
        }
        if (!fs.existsSync(audioFilePath)) {
            reject(new Error(`音频文件未找到: ${audioFilePath}`));
            return;
        }

        console.log('🎤 开始 Vosk 识别，文件:', audioFilePath);

        const proc = spawn(pythonExe, [scriptPath, audioFilePath], {
            windowsHide: true,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (data) => {
            stdout += data;
        });

        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (data) => {
            stderr += data;
        });

        proc.on('close', (code) => {
            try {
                if (fs.existsSync(audioFilePath)) {
                    fs.unlinkSync(audioFilePath);
                }
            } catch (e) {}

            if (code !== 0) {
                console.error('Vosk 进程退出，代码:', code, '错误:', stderr);
                reject(new Error(`识别失败，退出码 ${code}`));
                return;
            }

            const text = stdout.trim();
            console.log('📝 识别结果:', text);
            resolve(text);
        });

        proc.on('error', (err) => {
            reject(new Error(`启动 Vosk 失败: ${err.message}`));
        });
    });
});

// ==================== 在线音乐搜索（Meting） ====================
// ==================== 音乐搜索（使用本地 NeteaseCloudMusicApi） ====================
ipcMain.handle('search-and-play-song', async (event, songName) => {
    const apiBase = 'http://localhost:3000';
    console.log(`[音乐] 收到搜索请求: ${songName}`);
    try {
        // 1. 搜索歌曲
        const searchRes = await fetch(`${apiBase}/search?keywords=${encodeURIComponent(songName)}&limit=1`);
        const searchJson = await searchRes.json();
        if (!searchJson.result?.songs?.length) {
            return { success: false, message: '没找到这首歌' };
        }
        const song = searchJson.result.songs[0];
        const songId = song.id;
        console.log(`[音乐] 找到歌曲: ${song.name} (ID: ${songId})`);

        // 2. 获取播放链接（320kbps）
        const urlRes = await fetch(`${apiBase}/song/url?id=${songId}&br=320000`);
        const urlJson = await urlRes.json();
        if (!urlJson.data?.length || !urlJson.data[0].url) {
            return { success: false, message: '获取播放链接失败（可能版权限制）' };
        }
        const playUrl = urlJson.data[0].url;
        console.log(`[音乐] 播放链接获取成功`);

        return {
            success: true,
            songName: song.name,
            artist: song.artists.map(a => a.name).join(', '),
            playUrl: playUrl,
            cover: song.album.picUrl
        };
    } catch (err) {
        console.error('[音乐] 搜索异常:', err);
        return { success: false, message: err.message };
    }
});


// ==================== 应用生命周期 ====================
app.whenReady().then(() => {
    // 初始化模板路径（必须在 ready 之后）
    userDataPath = app.getPath('userData');
    templatesRoot = path.join(userDataPath, 'templates');
    if (!fs.existsSync(templatesRoot)) {
        fs.mkdirSync(templatesRoot, { recursive: true });
    }

    startTTSService();

    startMusicApiService();

    createWindow();
    createHttpServer();
    createWebSocketServer();
    globalShortcut.register('CommandOrControl+Q', () => app.quit());

     // ✅ 新增：按 Ctrl+Shift+H 强制显示寻慧
    globalShortcut.register('CommandOrControl+Shift+H', () => {
        if (win) {
            // 恢复窗口大小和位置
            const { width: scrW, height: scrH } = screen.getPrimaryDisplay().workAreaSize;
            win.setSize(400, 500);
            win.setPosition(scrW - 400, scrH - 500);
            win.setAlwaysOnTop(true);
            // 通知渲染进程显示女孩
            win.webContents.send('force-show-girl');
        }
    });
    
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (ttsProcess) {
        console.log('🛑 正在关闭 Edge‑TTS 服务...');
        ttsProcess.kill();
    }

    if (musicApiProcess) {          // 新增
        musicApiProcess.kill();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});


// ==================== IPC 事件：打开/关闭游戏窗口 ====================

ipcMain.on('open-gomoku', () => {
    createGomokuWindow();
});

ipcMain.on('open-checkers', () => {
    createCheckersWindow();
});

ipcMain.on('close-gomoku', () => {
    if (gomokuWindow) gomokuWindow.close();
});

ipcMain.on('close-checkers', () => {
    if (checkersWindow) checkersWindow.close();
});

// 转发游戏结果给主窗口
ipcMain.on('game-result', (event, data) => {
    if (win) {
        win.webContents.send('game-result', data);
    }
});

// ========== 窗口隐身/显示 ==========
ipcMain.on('toggle-visibility', (event, shouldHide) => {
    if (!win) return;
    const btnSize = 50;
    const { width: scrW, height: scrH } = screen.getPrimaryDisplay().workAreaSize;
    if (shouldHide) {
        // 隐身：缩小为右下角一个小方块（只显示按钮）
        win.setSize(btnSize, btnSize);
        win.setPosition(scrW - btnSize - 10, scrH - btnSize - 10);
        win.setAlwaysOnTop(true);
    } else {
        // 恢复默认大小和位置（与 createWindow 中的设置一致）
        const winWidth = 400;
        const winHeight = 500;
        win.setSize(winWidth, winHeight);
        win.setPosition(scrW - winWidth, scrH - winHeight);
        win.setAlwaysOnTop(true);
    }
});
// ===================================
// ========== 新增：PPT 模板选择与填充 ==========
ipcMain.handle('select-ppt-template', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '请选择 PPT 模板文件',
        filters: [
            { name: 'PowerPoint 文件', extensions: ['pptx'] }
        ],
        properties: ['openFile']   // 只允许选文件
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

ipcMain.handle('fill-ppt-template', async (event, { templatePath, topic }) => {
    const pythonExe = getPythonExe();
    const scriptPath = path.join(__dirname, 'fill_ppt.py');

    if (!fs.existsSync(scriptPath)) {
        throw new Error('fill_ppt.py 未找到，请将脚本放在项目根目录');
    }
    if (!fs.existsSync(templatePath)) {
        throw new Error(`模板文件不存在：${templatePath}`);
    }

    const desktopDir = path.join(os.homedir(), 'Desktop');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    //const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeTopic = topic.replace(/[/\\?%*:|"<>]/g, ''); // 去除非法文件名字符
    const outputPath = path.join(desktopDir, `关于${safeTopic}_${timestamp}.pptx`);

    const fillData = {
        title: topic,
        content: `这是关于“${topic}”的演示文稿。`
    };

    // 写入临时 JSON 文件
    const tempJsonPath = path.join(os.tmpdir(), `ppt_fill_${Date.now()}.json`);
    fs.writeFileSync(tempJsonPath, JSON.stringify(fillData, null, 2), 'utf8');

    return new Promise((resolve, reject) => {
        const cmd = `"${pythonExe}" "${scriptPath}" "${templatePath}" "${outputPath}" "${tempJsonPath}"`;
        exec(cmd, (error, stdout, stderr) => {
            // 清理临时文件
            try { fs.unlinkSync(tempJsonPath); } catch (e) {}
            
            if (error) {
                console.error('PPT 生成失败:', stderr);
                reject(new Error(stderr || error.message));
            } else {
                console.log('PPT 生成成功:', stdout);
                resolve(outputPath);
            }
        });
    });
});

// ========== 模板管理（多模板 + AI 智能选择） ==========
ipcMain.handle('get-user-data-path', () => app.getPath('userData'));

ipcMain.handle('save-template', async (event, sourcePath, ollamaUrl) => {

    console.log('📡 模板分析使用 Ollama 地址:', ollamaUrl);
    
    try {

        console.log('📥 收到模板路径:', sourcePath);

        if (!sourcePath.toLowerCase().endsWith('.pptx')) {
            throw new Error('只接受 .pptx 文件');
        }

        const folderName = `${path.basename(sourcePath, '.pptx')}_${Date.now()}`;
        const templateDir = path.join(templatesRoot, folderName);
        fs.mkdirSync(templateDir);

        const targetPath = path.join(templateDir, 'template.pptx');
        fs.copyFileSync(sourcePath, targetPath);
        
        console.log('📄 开始提取模板文本...');
        const extractedText = await extractTemplateText(targetPath);
        console.log('✅ 提取成功，长度:', extractedText.length);
        
        console.log('🤖 开始 AI 分析...');
        const description = await analyzeTemplateContent(extractedText, ollamaUrl);
        console.log('✅ AI 分析结果:', description);
        
        const info = {
            name: path.basename(sourcePath, '.pptx'),
            description: description || '通用模板',
            createdAt: new Date().toISOString()
        };
        fs.writeFileSync(path.join(templateDir, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
        
        return { id: folderName, name: info.name, description: info.description };
    } catch (e) {
        console.error('❌ save-template 完整错误:', e);
        console.error('错误堆栈:', e.stack);
        throw e;
    }
});

ipcMain.handle('get-templates', async () => {
    if (!fs.existsSync(templatesRoot)) return [];
    const dirs = fs.readdirSync(templatesRoot);
    const templates = [];
    for (const dir of dirs) {
        const infoPath = path.join(templatesRoot, dir, 'info.json');
        if (fs.existsSync(infoPath)) {
            const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            templates.push({ id: dir, name: info.name, description: info.description });
        }
    }
    return templates;
});

ipcMain.handle('delete-template', async (event, templateId) => {
    const templateDir = path.join(templatesRoot, templateId);
    if (fs.existsSync(templateDir)) {
        fs.rmSync(templateDir, { recursive: true });
        return true;
    }
    return false;
});

ipcMain.handle('select-best-template', async (event, topic) => {
    const templates = [];
    if (fs.existsSync(templatesRoot)) {
        const dirs = fs.readdirSync(templatesRoot);
        for (const dir of dirs) {
            const infoPath = path.join(templatesRoot, dir, 'info.json');
            if (fs.existsSync(infoPath)) {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                templates.push({ id: dir, name: info.name, description: info.description });
            }
        }
    }
    if (templates.length === 0) return null;
    if (templates.length === 1) return templates[0].id;

    const descList = templates.map((t, i) => `${i+1}. ${t.description}`).join('\n');
    const prompt = `用户要生成一个关于"${topic}"的PPT。现有模板信息如下：\n${descList}\n请只输出最合适的模板序号（数字，如 1），不要输出其他任何内容。`;
    
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({ model: 'qwen2:7b', prompt, stream: false })
        });
        const data = await response.json();
        const index = parseInt(data.response.trim()) - 1;
        return (templates[index] && templates[index].id) || templates[0].id;
    } catch (e) {
        return templates[0].id;
    }
});
// 📎 允许用户通过按钮选择 pptx 文件
ipcMain.handle('select-ppt-file', async () => {
    const result = await dialog.showOpenDialog(win, {
        title: '请选择 PPT 模板文件',
        filters: [{ name: 'PowerPoint 文件', extensions: ['pptx'] }],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('shell-open-external', (event, url) => {
    return shell.openExternal(url);
});

ipcMain.handle('os-totalmem', () => {
    return os.totalmem();
});

ipcMain.handle('os-freemem', () => {
    return os.freemem();
});

ipcMain.handle('fs-writeFile', (event, filePath, data) => {
    fs.writeFileSync(filePath, Buffer.from(data));
});