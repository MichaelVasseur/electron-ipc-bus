/// <reference path="typings/electron.d.ts"/>
// Take care to not reference Nodes but Electron only

export function GuessElectronProcessType(): string {
    let processType = "node"; // Node by default

    // Will raise an exception in a Node Process
    let electron = null;
    try {
        electron = require("electron");
    }
    catch (e) {
        return processType;
    }

    processType = process.type;
    // May be null in Sandbox or in Node Process
    if (processType == null) {
        const ipcRend = electron.ipcRenderer;
        if (ipcRend != null) {
            processType = "renderer";
        }
        else {
            const ipcMain = electron.ipcMain;
            if (ipcMain != null) {
                processType = "browser";
            }
        }
    }
    return processType;
}