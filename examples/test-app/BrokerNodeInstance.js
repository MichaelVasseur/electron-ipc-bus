//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

console.log('IPC Broker instance : Starting')

const ipcBusModule = require('electron-ipc-bus');
const ipcBroker = ipcBusModule.CreateIpcBusBroker();
ipcBusModule.ActivateIpcBusTrace(true);

ipcBroker.start()
    .then((msg) => {
        console.log('IPC Broker instance : Started');
    })
    .catch((err) => {
        console.log('IPC Broker instance : ' + err);
    });
    

function dispatchMessage(msg)
{
    console.log('IPC Broker instance : receive message:' + JSON.stringify(msg));
     var msgJSON = JSON.parse(msg);
     if (msgJSON.action === 'queryState') {
         let queryState = ipcBroker.queryState();
         process.send({event: 'queryState', result: queryState});
     }
}

process.send({ event: 'ready' });

process.on('message', dispatchMessage);