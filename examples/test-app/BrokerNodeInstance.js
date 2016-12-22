//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

console.log("Starting IPC Broker instance ...")

const ipcBusModule = require("electron-ipc-bus");
const ipcBroker = ipcBusModule.CreateIpcBusBroker();

ipcBroker.start()
process.send({ event: "ready" });