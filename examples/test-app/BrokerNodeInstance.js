//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

console.log('IPC Broker instance : Starting')

const ipcBusModule = require('electron-ipc-bus');
const ipcBrokerNode = ipcBusModule.CreateIpcBusBrokerNode();
ipcBusModule.ActivateIpcBusTrace(true);

ipcBrokerNode.start()
    .then((msg) => {
        console.log('IPC Broker instance : Started');

        process.send({ event: 'ready' });
    })
    .catch((err) => {
        console.log('IPC Broker instance : ' + err);
    });
    

function dispatchMessage(msg)
{
    console.log('IPC Broker instance : receive message:' + JSON.stringify(msg));
     var msgJSON = JSON.parse(msg);
     if (msgJSON.action === 'queryState') {
         let queryState = ipcBrokerNode.queryState();
         process.send({event: 'queryState', result: queryState});
     }
}

process.on('message', dispatchMessage);