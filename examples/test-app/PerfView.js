var processToMaster;
var transaction = 1;
function doPerformance(event) {
    var msgContent =
    {
        transaction : transaction,
        payload: 'very light'
    };
    ++transaction;
    processToMaster.send('start-performance-tests', 1024 * 1024);
}

function doClear(event) {
     var table = document.getElementById("perfResults");
     while(table.rows.length > 1) {
          table.deleteRow(1);
     }
}

function onIPCBus_TestPerformanceResult(topicName, msgContent, peerName) {
     var delay = msgContent.response.timeStamp - msgContent.origin.timeStamp;

     var table = document.getElementById("perfResults");
     var row = table.insertRow(-1);
     var cell1 = row.insertCell(-1);
     var cell2 = row.insertCell(-1);
     var cell3 = row.insertCell(-1);
     cell1.innerHTML = `#${msgContent.origin.peerName} (${msgContent.origin.type})`;
     cell2.innerHTML = `#${msgContent.response.peerName} (${msgContent.response.type})`;
     cell3.innerHTML = `${delay}`;
}

var processToMaster = new ProcessConnector('browser', ipcRenderer);

ipcBus.connect()
    .then(() => {
        console.log('renderer : connected to ipcBus');
        ipcBus.subscribe('test-performance-result', onIPCBus_TestPerformanceResult);
    });
