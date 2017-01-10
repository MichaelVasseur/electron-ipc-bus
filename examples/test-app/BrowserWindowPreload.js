//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

window.ipcBus = require('electron-ipc-bus').CreateIpcBus();
require('electron-ipc-bus').ActivateIpcBusTrace(true);

window.ipcRenderer = require('electron').ipcRenderer;

// require('electron').remote.getCurrentWindow().id

// const path = require('path');
// var preloadFile = path.join(__dirname, 'BundledBrowserWindowPreload.js');
// var width = 1000;

// const remote = require('electron').remote;
// const BrowserWindow = remote.BrowserWindow;

// window.CreateInnerPage = function _CreateInnerPage(processId) {
//         const rendererWindow = new BrowserWindow({
//             width: width, height: 600,
//             webPreferences:
//             {
//                 preload: preloadFile
//             }
//         });
//         rendererWindow.loadURL('file://' + path.join(__dirname, 'CommonView.html'));
//         rendererWindow.webContents.on('dom-ready', function () {
//             rendererWindow.webContents.send('initializeWindow', { title: 'Renderer', type: 'renderer', id: processId, peerName: 'Renderer_' + rendererWindow.webContents.id, webContentsId: rendererWindow.webContents.id });
//         });
// };

