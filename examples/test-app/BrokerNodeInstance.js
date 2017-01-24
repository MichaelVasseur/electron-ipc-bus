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
    console.log('IPC Broker instance : receive message:' + msg);
     var msgJSON = JSON.parse(msg);
     if (msg.queryState) {
         let queryState = ipcBroker.queryState();
         process.send({event: 'queryState', results: queryState});
     }
}

process.send({ event: 'ready' });

process.on('message', dispatchMessage);