'use strict';

var processToMaster;
var transaction = 1;
function doPerformance(type) {
    var bufferSize = 1024 * 1024;
    var memVal = document.querySelector(".memory-value");
    if (memVal) {
        bufferSize = memVal.value;
    }
        
    var typeCommandElt = document.querySelector('.typeCommand');
    var testParams =
    {
        transaction: transaction,
        typeCommand: typeCommandElt.options[typeCommandElt.selectedIndex].text,
        typeArgs: type,
        bufferSize: bufferSize
    };
    ++transaction;
    processToMaster.send('start-performance-tests', testParams);
}

var results = new Map;
var delays = [];

function doClear(event) {
     var table = document.getElementById('perfResults');
     while(table.rows.length > 1) {
          table.deleteRow(1);
     }
     results.clear();
     delays = [];   
}

function doTraceEnable(event) {
    ipcBus.send('test-performance-trace', event.currentTarget.checked);
}

function doSort(event) {
    var table = document.getElementById('perfResults');
    while(table.rows.length > 1) {
         table.deleteRow(1);
    }
    delays.forEach((delay) => {
        onIPCBus_TestPerformanceResult(delay);
    })
}

function onIPCBus_TestPerformanceStart(ipcBusEvent, msgTestStart) {
    var uuid = msgTestStart.uuid;
    let result = results.get(uuid);
    if (!result) {
        result = {};
        results.set(uuid,result);
    }
    result.start = msgTestStart;
    if (result.stop) {
        onIPCBus_AddTestPerformanceResult(result);
    }
}

function onIPCBus_TestPerformanceStop(ipcBusEvent, msgTestStop) {
    var uuid = msgTestStop.uuid;
    let result = results.get(uuid);
    if (!result) {
        result = {};
        results.set(uuid,result);
    }
    result.stop = msgTestStop;
    if (result.start) {
        onIPCBus_AddTestPerformanceResult(result);
    }
}

function onIPCBus_AddTestPerformanceResult(result) {
    var msgTestStart = result.start;
    var msgTestStop = result.stop;
    if (msgTestStart && msgTestStop) {
        result.delay = msgTestStop.timeStamp - msgTestStart.timeStamp;
        delays.push(result);
        delays.sort((l, r) => l.delay - r.delay);
    }
    onIPCBus_TestPerformanceResult(result);
}    

function onIPCBus_TestPerformanceResult(result) {
    var msgTestStart = result.start;
    var msgTestStop = result.stop;
    if (msgTestStart && msgTestStop) {
        var table = document.getElementById('perfResults');
        var row = table.insertRow(-1);
        var cell0 = row.insertCell(-1);
        var cell1 = row.insertCell(-1);
        var cell2 = row.insertCell(-1);
        var cell3 = row.insertCell(-1);
        cell0.innerHTML = `${msgTestStart.test.typeCommand} ${msgTestStart.test.typeArgs} (${msgTestStart.test.bufferSize})`;
        cell1.innerHTML = JSON.stringify(msgTestStart.peer);
        cell2.innerHTML = JSON.stringify(msgTestStop.peer);
        cell3.setAttribute('delay', result.delay);
        cell3.innerHTML = `${result.delay}`;

        var q = (delays.length / 5);
        var q1 = Math.floor(q);
        var q2 = Math.floor(q * 2);
        var q3 = Math.floor(q * 3); 
        var q4 = Math.floor(q * 4);

        for (var i = 1; i < table.rows.length; ++i) {
            var curRow = table.rows[i];
            var delay = curRow.cells[3].getAttribute('delay');
            if (delay <= delays[q1].delay) {
                curRow.className = 'success';
                continue;
            } 
            if (delay <= delays[q2].delay) {
                curRow.className = 'info';
                continue;
            } 
            if (delay >= delays[q4].delay) {
                curRow.className = 'danger';
                continue;
            } 
            if (delay >= delays[q3].delay) {
                curRow.className = 'warning';
                continue;
            } 
            curRow.className = '';
        }
    }
}

var processToMaster = new ProcessConnector('browser', ipcRenderer);

document.addEventListener('DOMContentLoaded', () => {
    var memSlide = document.querySelector(".memory-slide");
    var memVal = document.querySelector(".memory-value");
    if (memSlide && memVal) {
        memSlide.addEventListener("change", () => {
            memVal.value = memSlide.value;
        });
    }
});

ipcBus.connect()
    .then(() => {
        console.log('renderer : connected to ipcBus');
        ipcBus.on('test-performance-start', onIPCBus_TestPerformanceStart);
        ipcBus.on('test-performance-stop', onIPCBus_TestPerformanceStop);
    });

