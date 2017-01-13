PerfTests = (function () {
    function PerfTests(ipcBus, type) {
        var _ipcBus = ipcBus;
        var _type = type;

        _ipcBus.subscribe('test-performance-run', onIPCBus_TestPerformanceRun);
        _ipcBus.subscribe('test-performance-'+ _type, onIPCBus_TestPerformance);

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

        this.doPerformanceTests = function _doPerformanceTests(testParams) {
            _ipcBus.send('test-performance-run', testParams);
        }

        function onIPCBus_TestPerformanceRun(topicName, testParams, peerName) {
            var uuid = createUuid();
            var uuidPattern = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
            uuid = uuid + uuidPattern.substring(0, 30 - uuid.length)
            var msgContent = allocateString(uuid, testParams.bufferSize);
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

        function onIPCBus_TestPerformance(topicName, msgContent, peerName) {
            var uuid = msgContent.substring(0, 30);
            var msgTestStop = { 
                uuid: uuid,
                type: _type, 
                stop: {
                    peerName: _ipcBus.peerName,
                }
            };
            msgTestStop.stop.timeStamp = Date.now();
            _ipcBus.send('test-performance-stop', msgTestStop);
        }

    }
    return PerfTests;
})();