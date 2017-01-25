/// <reference path="typings/electron.d.ts"/>
// Take care to not reference Node but Electron only

export function GuessElectronProcessType(): string {
    // Will raise an exception in a Node Process
    let electron = null;
    try {
        electron = require('electron');
    }
    catch (e) {
        return null; // Means Node process
    }

    let processType = process.type;
    // May be null in Electron sandbox mode or in a Node Process
    if (processType == null) {
        if (electron.ipcRenderer) {
            processType = 'renderer';
        }
        else {
            if (electron.ipcMain) {
                processType = 'browser';
            }
        }
    }
    return processType;
}