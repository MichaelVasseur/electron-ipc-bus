//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

console.log("IPC Broker instance : Starting")

const ipcBusModule = require("electron-ipc-bus");
const ipcBroker = ipcBusModule.CreateIpcBusBroker();
ipcBusModule.ActivateIpcBusTrace(true);

ipcBroker.start()
    .then((msg) => {
        console.log("IPC Broker instance : Started");
    })
    .catch((err) => {
        console.log("IPC Broker instance : " + err);
    });
    
process.send({ event: "ready" });