//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

window.ipcBus = require("../electron-ipc-bus")("renderer")
window.ipcRenderer = require("electron").ipcRenderer
window.IsSandboxEnabled = (exports === undefined); 
