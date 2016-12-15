//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

//window.ipcBus = require("../electron-ipc-bus")("renderer")
//window.ipcBusModule = require("../build/IpcBusInterfaces");
window.ipcBusModule = require("../build/IpcBusInterfaces");
//window.ipcBus = ipcBusModule.CreateIPCBusClient(process);
window.ipcRenderer = require("electron").ipcRenderer
