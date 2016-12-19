//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

//window.ipcBus = require("../electron-ipc-bus")("renderer")
//window.ipcBusModule = require("../build/IpcBusInterfaces");
const ipcBusModule = require("../build/electron-ipc-bus");
window.ipcBus = ipcBusModule.CreateIPCBusClient(ipcBusModule.ProcessType.Renderer);
window.ipcRenderer = require("electron").ipcRenderer
