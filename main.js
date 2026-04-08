const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

let win;
let wss = null;

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
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');
    win.setPosition(width - winWidth, height - winHeight);
    // win.webContents.openDevTools();  // 需要调试可取消注释

    win.on('closed', () => { win = null; });
}

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
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    server.listen(8080, '0.0.0.0', () => {
        console.log('✅ HTTP 服务已启动，手机请访问 http://<电脑IP>:8080');
    });
}

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

app.whenReady().then(() => {
    createWindow();
    createHttpServer();
    createWebSocketServer();
    globalShortcut.register('CommandOrControl+Q', () => app.quit());
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });