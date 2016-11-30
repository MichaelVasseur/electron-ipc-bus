//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

console.log("Starting IPC Broker instance ...")

const Module = require('module')
const path = require('path')

const ipcBroker = require("../electron-ipc-bus")("broker")

ipcBroker.start()
process.send({ event: "ready" });