//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

console.log("Starting IPC Broker instance ...")

const Module = require('module')
const path = require('path')

// Override module loading
const originalResolveFilename = Module._resolveFilename
const newResolveFilename = function (request, parent, isMain) {

    switch (request) {
        case 'ipc-bus':
            return originalResolveFilename(path.join(path.dirname(process.argv0), "resources", "electron.asar", "common", "api", "ipc-bus.js"), parent, isMain)
        default:
            return originalResolveFilename(request, parent, isMain)
    }
}

Module._resolveFilename = newResolveFilename;

const ipcBroker = require("ipc-bus")("broker")
ipcBroker.start()
process.send({ event: "ready" });