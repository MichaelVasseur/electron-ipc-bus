/// <reference path="typings/electron.d.ts"/>
// Take care to not reference Nodes but Electron only

export function GuessElectronProcessType(): string {
    let processType: string = process.type;
    // May be null in Sandbox or in Node Process
    if (processType == null) {
        try {
            // Will raise an exception in Node Process
            let ipcRend = require("electron").ipcRenderer;
            if (ipcRend != null) {
                processType = "renderer";
            }
            else {
                let ipcMain = require("electron").ipcMain;
                if (ipcMain != null) {
                    processType = "browser";
                }
                else {
                    processType = null; // Node
                }
            }
        }
        catch (e) {
            processType = null; // Node
        }
    }
    return processType;
}