'use strict';

var processToMaster;
var transaction = 1;
function doPerformance(event) {
    var testParams =
    {
        transaction: transaction,
//        type: 'object',
        bufferSize: 1024 * 1024
    };
    ++transaction;
    processToMaster.send('start-performance-tests', testParams);
}

var testStart = new Map;
var testStop = new Map;

function doClear(event) {
     var table = document.getElementById("perfResults");
     while(table.rows.length > 1) {
          table.deleteRow(1);
     }
     testStart.clear();
     testStop.clear();
}

function onIPCBus_TestPerformanceStart(topicName, msgTestStart, peerName) {
    var uuid = msgTestStart.uuid;
    testStart.set(uuid, msgTestStart);
    if (testStop.get(uuid)) {
        onIPCBus_TestPerformanceResult(uuid);
    }
}

function onIPCBus_TestPerformanceStop(topicName, msgTestStop, peerName) {
    var uuid = msgTestStop.uuid;
    testStop.set(uuid, msgTestStop);
    if (testStart.get(uuid)) {
        onIPCBus_TestPerformanceResult(uuid);
    }
}

function onIPCBus_TestPerformanceResult(uuid) {
    var msgTestStart = testStart.get(uuid);
    var msgTestStop = testStop.get(uuid);
    if (msgTestStart && msgTestStop) {
        var delay = msgTestStop.stop.timeStamp - msgTestStart.start.timeStamp;

        var table = document.getElementById("perfResults");
        var row = table.insertRow(-1);
        var cell0 = row.insertCell(-1);
        var cell1 = row.insertCell(-1);
        var cell2 = row.insertCell(-1);
        var cell3 = row.insertCell(-1);
        cell0.innerHTML = `#${msgTestStart.start.peerName} (${msgTestStart.type})`;
        cell1.innerHTML = `#${msgTestStart.start.peerName} (${msgTestStart.type})`;
        cell2.innerHTML = `#${msgTestStop.stop.peerName} (${msgTestStop.type})`;
        cell3.innerHTML = `${delay}`;
    }
}

var processToMaster = new ProcessConnector('browser', ipcRenderer);

ipcBus.connect()
    .then(() => {
        console.log('renderer : connected to ipcBus');
        ipcBus.subscribe('test-performance-start', onIPCBus_TestPerformanceStart);
        ipcBus.subscribe('test-performance-stop', onIPCBus_TestPerformanceStop);
    });

