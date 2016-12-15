//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

//window.ipcBus = require("../electron-ipc-bus")("renderer")
//const ipcBusModule = require("../build/IpcBusInterfaces");
window.ipcBusModule = require("../build/IpcBusInterfaces");
window.ipcRenderer = require("electron").ipcRenderer
