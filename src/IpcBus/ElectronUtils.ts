/// <reference path="typings/electron.d.ts"/>
// Take care to not reference Node but Electron only

export function GuessElectronProcessType(): string {
    // Will raise an exception in a Node Process
    let electron = null;
    try {
        electron = require("electron");
    }
    catch (e) {
        return null; // Means Node process
    }

    let processType = process.type;
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