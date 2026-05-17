// deps.js（安全版）
const ipcRenderer = {
    invoke: (channel, ...args) => window.electronAPI.invoke(channel, ...args),
    send: (channel, ...args) => window.electronAPI.send(channel, ...args),
    on: (channel, callback) => window.electronAPI.on(channel, callback),
    removeAllListeners: (channel) => window.electronAPI.removeAllListeners(channel)
};

const shell = {
    openExternal: (url) => window.electronAPI.invoke('shell-open-external', url)
};

const fs = {
    existsSync: (filePath) => window.electronAPI.fsExistsSync(filePath),
    readFileSync: (filePath, encoding) => window.electronAPI.fsReadFileSync(filePath, encoding),
    writeFileSync: (filePath, data, encoding) => window.electronAPI.fsWriteFileSync(filePath, data, encoding),
    appendFileSync: (filePath, data, encoding) => window.electronAPI.fsAppendFileSync(filePath, data, encoding),
    promises: {
        writeFile: (filePath, data) => window.electronAPI.invoke('fs-writeFile', filePath, data)
    }
};

const path = {
    join: (...args) => window.electronAPI.pathJoin(...args),
    basename: (filePath, ext) => window.electronAPI.pathBasename(filePath, ext)
};

const os = {
    homedir: () => window.electronAPI.homedir(),
    tmpdir: () => window.electronAPI.tmpdir(),
    totalmem: async () => await window.electronAPI.invoke('os-totalmem'),
    freemem: async () => await window.electronAPI.invoke('os-freemem')
};

let _girl = null;
let _bubble = null;

function getGirlElement() {
    if (!_girl && typeof document !== 'undefined') {
        _girl = document.getElementById('girl');
    }
    return _girl;
}

function getBubbleElement() {
    if (!_bubble && typeof document !== 'undefined') {
        _bubble = document.getElementById('bubble');
    }
    return _bubble;
}

window.DEPENDENCIES = {
    ipcRenderer,
    shell,
    fs,
    path,
    os,
    get PptxGenJS() { return window.PptxGenJS; },
    get girl() { return getGirlElement(); },
    get bubble() { return getBubbleElement(); }
};