var PerfTests = function _PerfTests(type) {
    const _ipcBusModule = require('electron-ipc-bus');
    var _ipcBus = _ipcBusModule.CreateIpcBus();
    var _type = type;

    _ipcBus.subscribe('test-performance-trace', onIPCBus_TestPerformanceTrace);
    _ipcBus.subscribe('test-performance-run', onIPCBus_TestPerformanceRun);
    _ipcBus.subscribe('test-performance-'+ _type, onIPCBus_TestPerformance);

    this.doPerformanceTests = function _doPerformanceTests(testParams) {
        _ipcBus.send('test-performance-run', testParams);
    }

    function allocateString(seed, num) {
        num = Number(num) / 100;
        var result = seed;
        var str ='####################################################################################################';
        while (true) {
            if (num & 1) { // (1)
                result += str;
            }
            num >>>= 1; // (2)
            if (num <= 0) break;
            str += str;
        }
        return result;
    }

    function createUuid() {
        return Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
    }

    function onIPCBus_TestPerformanceTrace(ipcBusEvent, activateTrace) {
        _ipcBusModule.ActivateIpcBusTrace(activateTrace);
    }

    function onIPCBus_TestPerformanceRun(ipcBusEvent, testParams) {
        var uuid = createUuid();
        var uuidPattern = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        uuid = uuid + uuidPattern.substring(0, 30 - uuid.length)
        var payload = allocateString(uuid, testParams.bufferSize);

        var msgContent;
        if (testParams.type == 'string') {
            msgContent = payload;
        }
        else{
            msgContent = { 
                uuid: uuid, 
                payload: payload 
            };
        }

        var msgTestStart = { 
            uuid: uuid,
            test: testParams,
            type: _type, 
            start: {
                peerName: _ipcBus.peerName,
            }
        };
        msgTestStart.start.timeStamp = Date.now();
        _ipcBus.send('test-performance-start', msgTestStart);

        _ipcBus.send('test-performance-renderer', msgContent);
        _ipcBus.send('test-performance-node', msgContent);
        _ipcBus.send('test-performance-browser', msgContent);
    }

    function onIPCBus_TestPerformance(ipcBusEvent, msgContent) {
        var dateNow = Date.now();
        var uuid;
        try {
            uuid = msgContent.substring(0, 30);
        }
        catch(e) {
            uuid = msgContent.uuid;
        }
        var msgTestStop = { 
            uuid: uuid,
            type: _type, 
            stop: {
                timeStamp: dateNow,
                peerName: _ipcBus.peerName,
            }
        };
        _ipcBus.send('test-performance-stop', msgTestStop);
    }
}

module.exports = PerfTests;