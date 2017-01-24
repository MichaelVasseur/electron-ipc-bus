var PerfTests = function _PerfTests(type) {
    const _ipcBusModule = require('electron-ipc-bus');
    var _ipcBus = _ipcBusModule.CreateIpcBus();
    var _type = type;

    this.doPerformanceTests = function _doPerformanceTests(testParams) {
        _ipcBus.send('test-performance-run', testParams);
    }

    this.onIPCBus_TestPerformance = function _onIPCBus_TestPerformance(ipcBusEvent, msgContent) {
        var dateNow = Date.now();
        var uuid;
        try {
            uuid = msgContent.substring(0, 30);
        }
        catch(e) {
            uuid = msgContent.uuid;
        }
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve([msgContent]);
        }
        else {
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

    this.onIPCBus_TestPerformanceTrace = function _onIPCBus_TestPerformanceTrace(ipcBusEvent, activateTrace) {
        _ipcBusModule.ActivateIpcBusTrace(activateTrace);
    }

    this.onIPCBus_TestPerformanceRun = function _onIPCBus_TestPerformanceRun(ipcBusEvent, testParams) {
        this.testPerformance('test-performance-renderer', testParams);
        this.testPerformance('test-performance-node', testParams);
        this.testPerformance('test-performance-browser', testParams);
    }

    this.testPerformance = function _testPerformance(type, testParams) {
        var uuid = createUuid();
        var uuidPattern = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        uuid = uuid + uuidPattern.substring(0, 30 - uuid.length)
        var payload = allocateString(uuid, testParams.bufferSize);

        var msgTestStart = { 
            uuid: uuid,
            test: testParams,
            type: _type, 
            start: {
                peerName: _ipcBus.peerName,
            }
        };

        var msgContent;
        if (testParams.typeArgs === 'string') {
            msgContent = payload;
        }
        else if (testParams.typeArgs === 'object') {
            msgContent = { 
                uuid: uuid, 
                payload: payload 
            };
        }
        else if (testParams.typeArgs === 'args') {
            msgContent = [];
            msgContent.push({ 
                uuid: uuid, 
                payload: payload 
            });
            msgContent.push('string');
            msgContent.push(2.22);
            msgContent.push(true);
        }

        msgTestStart.start.timeStamp = Date.now();
        _ipcBus.send('test-performance-start', msgTestStart);
        if (testParams.typeArgs === 'args') {
            if (testParams.typeCommand == 'Request') {
                _ipcBus.request.apply(_ipcBus, [2000, type].concat(msgContent))
                .then((ipcRequestResponse) => this.onIPCBus_TestPerformance(ipcRequestResponse.event, ipcRequestResponse.payload[0])) 
                .catch();
            }
            else {
                _ipcBus.send.apply(_ipcBus, [type].concat(msgContent));
            }
        }
        else {
            if (testParams.typeCommand == 'Request') {
                _ipcBus.request(2000, type, msgContent)
                .then((ipcRequestResponse) => this.onIPCBus_TestPerformance(ipcRequestResponse.event, ipcRequestResponse.payload[0])) 
                .catch();
            }
            else {
                _ipcBus.send(type, msgContent);
            }
        }
    }

    _ipcBus.on('test-performance-trace', (ipcBusEvent, activateTrace) => this.onIPCBus_TestPerformanceTrace(ipcBusEvent, activateTrace));
    _ipcBus.on('test-performance-run', (ipcBusEvent, testParams) => this.onIPCBus_TestPerformanceRun(ipcBusEvent, testParams));
    _ipcBus.on('test-performance-'+ _type, (ipcBusEvent, msgContent) => this.onIPCBus_TestPerformance(ipcBusEvent, msgContent));

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
}

module.exports = PerfTests;