var PerfTests = function _PerfTests(type, busPath) {
    const _ipcBusModule = require('electron-ipc-bus');
    var _ipcBus = _ipcBusModule.CreateIpcBusClient(busPath);
    var _type = type;

    this.doPerformanceTests = function _doPerformanceTests(testParams) {
        _ipcBus.send('test-performance-run', testParams);
    }

    this.connect = function() {
        _ipcBus.connect(`perfTestsBus ${_type}`)
            .then((msg) => {
                _ipcBus.on('test-performance-trace', (ipcBusEvent, activateTrace) => this.onIPCBus_TestPerformanceTrace(ipcBusEvent, activateTrace));
                _ipcBus.on('test-performance-run', (ipcBusEvent, testParams) => this.onIPCBus_TestPerformanceRun(ipcBusEvent, testParams));
                _ipcBus.on('test-performance-'+ _type, (ipcBusEvent, msgContent) => this.onIPCBus_TestPerformance(ipcBusEvent, msgContent));
            });
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

        var msgTestStart = { 
            uuid: uuid,
            test: testParams,
            type: _type, 
            peer: _ipcBus.peer
        };

        var msgContent;
        if (testParams.typeArgs === 'string') {
            msgContent = allocateString(uuid, testParams.bufferSize);
        }
        else if (testParams.typeArgs === 'object') {
            msgContent = { 
                uuid: uuid, 
                payload: allocateString(uuid, testParams.bufferSize)
            };
        }
        else if (testParams.typeArgs === 'buffer') {
            msgContent = Buffer.alloc(Number(testParams.bufferSize));
            msgContent.write(uuid, 0, uuid.length, 'utf8');
        }
        else if (testParams.typeArgs === 'args') {
            msgContent = [];
            msgContent.push({ 
                uuid: uuid, 
                payload: allocateString(uuid, testParams.bufferSize / 2)
            });
            msgContent.push('string');
            msgContent.push(2.22);
            msgContent.push(true);
            msgContent.push(Buffer.alloc(Number(testParams.bufferSize / 2)));
        }

        msgTestStart.timeStamp = Date.now();
        _ipcBus.send('test-performance-start', msgTestStart);
        if (testParams.typeArgs === 'args') {
            if (testParams.typeCommand == 'Request') {
                _ipcBus.request.apply(_ipcBus, [2000, type, ...msgContent])
                .then((ipcRequestResponse) => this.onIPCBus_TestPerformance(ipcRequestResponse.event, ipcRequestResponse.payload[0])) 
                .catch();
            }
            else {
                _ipcBus.send(type, ...msgContent);
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

    this.onIPCBus_TestPerformance = function _onIPCBus_TestPerformance(ipcBusEvent, msgContent) {
        var dateNow = Date.now();
        var uuid;
        switch (typeof msgContent) {
            case 'object':
                if (Buffer.isBuffer(msgContent)) {
                    uuid = msgContent.toString('utf8', 0, 30);
                }
                // else if (Array.isArray(data)) {
                // }
                else {
                    uuid = msgContent.uuid;
                }
                break;
            case 'string':
                uuid = msgContent.substring(0, 30);
                break;
            case 'number':
                break;
            case 'boolean':
            break;
        }
            
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve([msgContent]);
        }
        else {
            var msgTestStop = { 
                uuid: uuid,
                type: _type, 
                timeStamp: dateNow,
                peer: _ipcBus.peer
            };
            _ipcBus.send('test-performance-stop', msgTestStop);
        }
    }

    this.onIPCBus_TestPerformanceTrace = function _onIPCBus_TestPerformanceTrace(ipcBusEvent, activateTrace) {
        _ipcBusModule.ActivateIpcBusTrace(activateTrace);
    }

    function allocateString(seed, num) {
        num = Number(num) / 100;
        var result = seed;
        var str ='0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789';
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