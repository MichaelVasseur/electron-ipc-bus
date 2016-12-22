//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

// window.ipcBus = require("../electron-ipc-bus")("renderer")
// const ipcBusModule = require("../../");
const ipcBusModule = require("electron-ipc-bus");
// window.ipcBus = ipcBusModule.CreateIpcBusForClient(ipcBusModule.ProcessType.Renderer);
window.ipcBus = ipcBusModule.CreateIpcBus();
window.ipcRenderer = require("electron").ipcRenderer
