/// <reference path="typings/electron.d.ts"/>

export function GuessElectronProcessType(): string {
    let processType: string = process.type;
    if (processType == null) {
        try {
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
        catch(e) {
            processType = null; // Node
        }
    }
    return processType;
}