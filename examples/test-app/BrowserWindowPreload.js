//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

const ipcBusModule = require("electron-ipc-bus");
// window.ipcBus = ipcBusModule.CreateIpcBusForClient("renderer");
window.ipcBus = ipcBusModule.CreateIpcBus();
window.ipcRenderer = require("electron").ipcRenderer
