//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

console.log("Starting IPC Broker instance ...")

const Module = require('module')
const path = require('path')

//const ipcBroker = require("../electron-ipc-bus")("broker")
const ipcBusModule = require("../build/IpcBusInterfaces");
const ipcBroker = ipcBusModule.CreateIPCBusBroker();

ipcBroker.start()
process.send({ event: "ready" });