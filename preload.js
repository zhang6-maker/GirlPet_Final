// preload.js
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('electronAPI', {
    // ═══════════════════════════════════════════
    // IPC 通信
    // ═══════════════════════════════════════════
    invoke: (channel, ...args) => {
        // 可在此处添加白名单校验，防止滥用
        const allowedChannels = [
            'get-templates',
            'save-template',
            'select-best-template',
            'get-user-data-path',
            'fill-ppt-template',
            'select-ppt-file',
            'transcribe-audio',
            'shell-open-external',
            'os-totalmem',
            'os-freemem',
            'os-getMemoryInfo',   // 新增一个批量获取内存信息的方法
            'fs-writeFile' 
        ];
        if (allowedChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        return Promise.reject(new Error(`不允许的 IPC 通道: ${channel}`));
    },
    send: (channel, ...args) => {
        const allowedChannels = [
            'open-gomoku',
            'open-checkers',
            'close-gomoku',
            'close-checkers',
            'game-result',
            'toggle-visibility',
            'reply-to-mobile',
            'mobile-command',
            'force-show-girl'
        ];
        if (allowedChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        }
    },
    on: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },

    // ═══════════════════════════════════════════
    // 路径操作
    // ═══════════════════════════════════════════
    pathJoin: (...args) => path.join(...args),
    pathBasename: (filePath, ext) => path.basename(filePath, ext),

    // ═══════════════════════════════════════════
    // 系统信息
    // ═══════════════════════════════════════════
    tmpdir: () => os.tmpdir(),
    homedir: () => os.homedir(),

    // ═══════════════════════════════════════════
    // 文件操作（同步版本，只读/写用户目录下文件，更安全）
    // ═══════════════════════════════════════════
    fsExistsSync: (filePath) => fs.existsSync(filePath),
    fsReadFileSync: (filePath, encoding) => fs.readFileSync(filePath, encoding),
    fsWriteFileSync: (filePath, data, encoding) => fs.writeFileSync(filePath, data, encoding),
    fsAppendFileSync: (filePath, data, encoding) => fs.appendFileSync(filePath, data, encoding),

    searchSong: (songName) => ipcRenderer.invoke('search-and-play-song', songName),
});