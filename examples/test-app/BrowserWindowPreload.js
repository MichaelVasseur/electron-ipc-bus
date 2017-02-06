//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

window.ipcBus = require('electron-ipc-bus').CreateIpcBusClient();
window.ipcBus_QUERYSTATE_CHANNEL = require('electron-ipc-bus').IPCBUS_CHANNEL_QUERY_STATE;
require('electron-ipc-bus').ActivateIpcBusTrace(true);

window.ipcRenderer = require('electron').ipcRenderer;
window.PerfTests = require('./PerfTests.js');


