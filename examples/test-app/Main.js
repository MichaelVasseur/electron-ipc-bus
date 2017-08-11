//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

// Node
const util = require('util');
const path = require('path');
const child_process = require('child_process');
const EventEmitter = require('events').EventEmitter;

// Electron 
const electronApp = require('electron').app;
const electronSession = require('electron').session;
const ipcMain = require('electron').ipcMain;
const BrowserWindow = require('electron').BrowserWindow;

// Debug rules
electronApp.commandLine.appendSwitch('remote-debugging-port', '55555');
electronApp.commandLine.appendSwitch('host-rules', 'MAP * 127.0.0.1');

// Misc
const uuid = require('uuid');
const busPath = 55556; // '/tr-ipc-bus/' + uuid.v4();
console.log('IPC Bus Path : ' + busPath);

// IPC Bus
const ipcBusModule = require('electron-ipc-bus');
const ipcBusClient = ipcBusModule.CreateIpcBusClient(busPath);
//ipcBusModule.ActivateIpcBusTrace(true);
ipcBusModule.ActivateServiceTrace(true);

// Startup
let ipcBrokerProcess = null;
let ipcBroker = null;
let ipcBridge = null;


// Load node-import without wrapping to variable. 
require('node-import');
imports('ProcessConnector');
const PerfTests = require('./PerfTests.js');


// Helpers
function spawnNodeInstance(scriptPath) {
    const args = [path.join(__dirname, scriptPath), '--parent-pid=' + process.pid, '--bus-path=' + busPath];

    let options = { env: {} };
    for (let key of Object.keys(process.env)) {
        options.env[key] = process.env[key];
    }

    options.env['ELECTRON_RUN_AS_NODE'] = '1';
    options.stdio = ['pipe', 'pipe', 'pipe', 'ipc'];
    return child_process.spawn(process.argv[0], args, options);
}

// Window const
const preloadFile = path.join(__dirname, 'BundledBrowserWindowPreload.js');
const commonViewUrl = 'file://' + path.join(__dirname, 'CommonView.html');
const perfViewUrl = 'file://' + path.join(__dirname, 'PerfView.html');
const width = 1000;

var MainProcess = (function () {

    const peerName = 'Main';

    function MainProcess() {

        console.log('<MAIN> MainProcess is running');

        var self = this;
        var processId = 1;
        var perfView = null;
        var instances = new Map;

        // Listen view messages
        var processMainFromView = new ProcessConnector('browser', ipcMain);
        processMainFromView.onRequestMessage(onIPCElectron_RequestMessage);
        processMainFromView.onSendMessage(onIPCElectron_SendMessage);
        processMainFromView.onSubscribe(onIPCElectron_Subscribe);
        processMainFromView.onUnsubscribe(onIPCElectron_Unsubscribe);
        processMainFromView.on('new-process', doNewProcess);
        processMainFromView.on('new-renderer', doNewRenderer);
        processMainFromView.on('new-perf', doNewPerfView);
        processMainFromView.on('start-performance-tests', doPerformanceTests)
        processMainFromView.on('queryState', doQueryState);

        console.log('<MAIN> ProcessConnect ready');

        var perfTests = new PerfTests('browser', busPath);
        perfTests.connect();
        console.log('<MAIN> PerfTest ready');

        const mainWindow = new BrowserWindow({
            width: width, height: 800,
            autoHideMenuBar: true,
            webPreferences:
            {
                preload: preloadFile
            }
        });
        mainWindow.on('close', function () {
            let keysTmp = [];
            for (let key of instances.keys()) {
                keysTmp.push(key);
            }
            for (let key of keysTmp) {
                instances.get(key).term();
            }
        });

        mainWindow.loadURL(commonViewUrl);

        console.log('<MAIN> Main window ready');

        var processMainToView = new ProcessConnector('browser', mainWindow.webContents);
        mainWindow.webContents.on('dom-ready', function () {
            mainWindow.webContents.send('initializeWindow', { title: 'Main', type: 'browser', id: 0, peerName: peerName, webContentsId: mainWindow.webContents.id });
        });

        function doNewProcess(processType) {
            var newProcess = null;
            switch (processType) {
                case 'renderer':
                    newProcess = new RendererProcess(processId);
                    break;
                case 'node':
                    newProcess = new NodeProcess(processId);
                    break;
            }
            if (newProcess != null) {
                instances.set(processId, newProcess);
                newProcess.onClose(function (localProcessId) {
                    instances.delete(localProcessId);
                });
                ++processId;
            }
        }

        function doNewRenderer(processId) {
            var rendererProcess = instances.get(processId);
            if (rendererProcess != null) {
                rendererProcess.createWindow();
            }
        }

        function doPerformanceTests(testParams) {
            perfTests.doPerformanceTests(testParams);
        }

        function doNewPerfView() {
            if (perfView) {
                perfView.show();
            }
            else {
                perfView = new BrowserWindow({
                    width: width, height: 800,
                    autoHideMenuBar: true,
                    webPreferences:
                    {
                        preload: preloadFile
                    }
                });
                perfView.on('close', () => {
                    perfView = null;
                });
                perfView.loadURL(perfViewUrl);
            }
        }

        function doQueryState() {
            if (ipcBroker) {
                var queryState = ipcBroker.queryState();
                mainWindow.webContents.send('get-queryState', queryState);
            }
            if (ipcBrokerProcess) {
                ipcBrokerProcess.once('message', (msgJSON) => {
                    var queryState = msgJSON.result;
                    mainWindow.webContents.send('get-queryState', queryState);
                });
                ipcBrokerProcess.send(JSON.stringify({action: 'queryState'}));
                
            }
        }

        function onIPCElectron_ReceivedMessage(ipcBusEvent, ipcContent) {
            console.log('Master - ReceivedMessage - topic:' + ipcBusEvent.channel + 'from #' + ipcBusEvent.sender.name);
            if (ipcBusEvent.request) {
                ipcBusEvent.request.resolve(ipcBusEvent.channel + ' - AutoReply from #' + ipcBusEvent.sender.name);
            }
            processMainToView.postReceivedMessage(ipcBusEvent, ipcContent);
        }

        function onIPCElectron_Subscribe(topicName) {
            console.log('Master - onIPCElectron_Subscribe:' + topicName);
            ipcBusClient.on(topicName, onIPCElectron_ReceivedMessage);
            processMainToView.postSubscribeDone(topicName);
        }

        function onIPCElectron_Unsubscribe(topicName) {
            console.log('Master - onIPCElectron_Subscribe:' + topicName);
            ipcBusClient.off(topicName, onIPCElectron_ReceivedMessage);
            processMainToView.postUnsubscribeDone(topicName);
        }

        function onIPCElectron_SendMessage(topicName, topicMsg) {
            console.log('Master - onIPCElectron_SendMessage : topic:' + topicName + ' msg:' + topicMsg);
            ipcBusClient.send(topicName, topicMsg);
        }

        function onIPCElectron_RequestMessage(topicName, topicMsg) {
            console.log('Master - onIPCElectron_RequestMessage : topic:' + topicName + ' msg:' + topicMsg);
            ipcBusClient.request(2000, topicName, topicMsg)
                .then((requestPromiseResponse) => {
                    processMainToView.postRequestThen(requestPromiseResponse);
                })
                .catch((requestPromiseResponse) => {
                    processMainToView.postRequestCatch(requestPromiseResponse);
                });
        }

    }
    return MainProcess;
})();

var RendererProcess = (function () {

    function RendererProcess(processId) {
        var rendererWindows = new Map();
        var callbackClose;
        this.createWindow = function _createWindow() {
            const rendererWindow = new BrowserWindow({
                width: width, height: 600,
                autoHideMenuBar: true,
                webPreferences:
                {
                    session: getSession(),
                    preload: preloadFile
                }
            });
            rendererWindow.loadURL(commonViewUrl);
            rendererWindow.webContents.on('dom-ready', function () {
                rendererWindow.webContents.send('initializeWindow', { title: 'Renderer', type: 'renderer', id: processId, peerName: 'Renderer_' + rendererWindow.webContents.id, webContentsId: rendererWindow.webContents.id });
            });

            rendererWindows.set(rendererWindow.webContents.id, rendererWindow);
            var key = rendererWindow.webContents.id;
            rendererWindow.on('close', () => {
                rendererWindows.delete(key);
                if (rendererWindows.size === 0) {
                    callbackClose(processId);
                }
            });
        };

        this.onClose = function _onClose(callback) {
            callbackClose = callback;
        };

        this.term = function _term() {
            let keysTmp = [];
            for (let key of rendererWindows.keys()) {
                keysTmp.push(key);
            }
            for (let key of keysTmp) {
                rendererWindows.get(key).close();
            }
        };

        function getSession() {
            var sessionName = 'persist:process' + processId;
            var session = electronSession.fromPartition(sessionName);
            return session;
        }

        this.createWindow();
    };
    return RendererProcess;
})();

// Classes
var NodeProcess = (function () {

    function NodeInstance() {
        this.process = spawnNodeInstance('NodeInstance.js');
        this.process.stdout.addListener('data', data => { console.log('<NODE> ' + data.toString()); });
        this.process.stderr.addListener('data', data => { console.log('<NODE> ' + data.toString()); });
        console.log('<MAIN> Node instance #' + this.process.pid + ' started !');
    }

    function NodeProcess(processId) {
        var self = this;

        var nodeWindow = null;
        var processMainToView = null;

        var nodeInstance = null;

        // Listen view messages
        var processMainFromView = new ProcessConnector('node', ipcMain, processId);
        processMainFromView.onRequestMessage(onIPCElectron_RequestMessage);
        processMainFromView.onSendMessage(onIPCElectron_SendMessage);
        processMainFromView.onSubscribe(onIPCElectron_Subscribe);
        processMainFromView.onUnsubscribe(onIPCElectron_Unsubscribe);

        // Create node process
        nodeInstance = new NodeInstance();
        nodeInstance.process.on('message', onIPCProcess_Message);
        nodeInstance.process.send(JSON.stringify({ action: 'init', args: { title: 'Node', type: 'node', id: processId } }));
        nodeInstance.process.on('exit', function () {
            if (nodeWindow) {
                nodeWindow.close();
                nodeWindow = null;
            }
        });

        // Create node window
        nodeWindow = new BrowserWindow({
            width: width, height: 600,
            autoHideMenuBar: true,
            webPreferences:
            {
                preload: preloadFile
            }
        });
        processMainToView = new ProcessConnector('node', nodeWindow.webContents, processId);
        nodeWindow.loadURL(commonViewUrl);
        nodeWindow.webContents.on('dom-ready', function () {
            nodeWindow.webContents.send('initializeWindow', { title: 'Node', type: 'node', id: processId, peerName: 'Node_' + nodeInstance.process.pid, webContentsId: nodeWindow.webContents.id });
        });

        nodeWindow.on('close', function () {
            nodeWindow = null;
            self.term();
        });

        this.term = function _term() {
            if (nodeInstance) {
                nodeInstance.process.kill();
                nodeInstance = null;
            }
        };

        this.onClose = function _onClose(callback) {
            nodeInstance.process.on('exit', function () {
                callback(processId);
            });
        };

        function onIPCProcess_Message(data) {
            var msgJSON = JSON.parse(data);
            if (msgJSON.hasOwnProperty('action')) {
                switch (msgJSON['action']) {
                    case 'receivedRequestThen':
                        processMainToView.postRequestThen(msgJSON['requestPromiseResponse']);
                        break;
                    case 'receivedRequestCatch':
                        processMainToView.postRequestCatch(msgJSON['requestPromiseResponse']);
                        break;
                    case 'receivedSend':
                        processMainToView.postReceivedMessage(msgJSON['args']['event'], msgJSON['args']['content']);
                        break;
                    case 'subscribe':
                        processMainToView.postSubscribeDone(msgJSON['topic']);
                        break;
                    case 'unsubscribe':
                        processMainToView.postUnsubscribeDone(msgJSON['topic']);
                        break;
                }
            }
        };

        function onIPCElectron_Subscribe(topicName) {
            console.log('Node - onIPCElectron_Subscribe:' + topicName);
            var msgJSON = {
                action: 'subscribe',
                topic: topicName
            };
            nodeInstance.process.send(JSON.stringify(msgJSON));
        };

        function onIPCElectron_Unsubscribe(topicName) {
            console.log('Node - onIPCElectron_Subscribe:' + topicName);
            var msgJSON = {
                action: 'unsubscribe',
                topic: topicName
            };
            nodeInstance.process.send(JSON.stringify(msgJSON));
            processMainToView.postUnsubscribeDone(topicName);
        };

        function onIPCElectron_RequestMessage(topicName, topicMsg) {
            console.log('Node - onIPCElectron_RequestMessage : topic:' + topicName + ' msg:' + topicMsg);
            var msgJSON = {
                action: 'request',
                args: { topic: topicName, msg: topicMsg }
            };
            nodeInstance.process.send(JSON.stringify(msgJSON));
        };

        function onIPCElectron_SendMessage(topicName, topicMsg) {
            console.log('Node - onIPCElectron_SendMessage : topic:' + topicName + ' msg:' + topicMsg);
            var msgJSON = {
                action: 'send',
                args: { topic: topicName, msg: topicMsg }
            };
            nodeInstance.process.send(JSON.stringify(msgJSON));
        };
    }

    return NodeProcess;

})();

function TimeServiceImpl() {

    EventEmitter.call(this);

    this.getCurrent = function(source) {
        console.log(`<MAIN> Service time is serving '${source}' with the current time !`);
        const currentTime = new Date().getTime();
        this.emit('currentTime', currentTime);
        return currentTime;
    };
}

class TimeServiceImpl2 extends EventEmitter {

    getCurrent(source) {
        console.log(`<MAIN Service> Service time is serving '${source}' with the current time !`);
        const currentTime = new Date().getTime();
        this.emit('currentTime', currentTime);
        return currentTime;
    };

    _beforeCallHandler(call, sender, request) {

        console.log(`<MAIN Service> About to call TimeServiceImpl2::${call.handlerName}`);

        return call.args;
    }
}

util.inherits(TimeServiceImpl, EventEmitter);

function startApp() {
    console.log('<MAIN> Connected to broker !');

    // Create the proxy (client-side)
    const timeServiceProxy = ipcBusModule.CreateIpcBusServiceProxy(ipcBusClient, 'time', 20000);
    
    // Check service's availability and make a remote call when it is available
    timeServiceProxy.queryWrapper(20000)
     .then((wrapper) => {
//    timeServiceProxy.connect().then(() => {
        console.log('<MAIN Service> Service is STARTED !');
        wrapper.getCurrent('After')
            .then((currentTime) => console.log(`<Remote Service> Current time = ${currentTime}`))
            .catch((err) => console.error(`<Remote Service> Time service returned error : ${err}`));
        // Subscribe to remote events (client-side)
        wrapper.on('emitted_event', () => {
            console.log(`<Remote Service> Received 'emitted_event' event from Time service`)
        });
        wrapper.on('not_emitted_event', () => {
            console.log(`<Remote Service> Received 'not_emitted_event' event from Time service`)
        });
    });

    // Make a remote call (client-side)
    // NOTE: This call might be delayed as the remote service may not be ready yet !
    // timeServiceProxy
    //     .call('getCurrent', 'Before')
    //     .then(
    //         (currentTime) => console.log(`<MAIN> Current time = ${currentTime}`),
    //         (err) => console.error(`<MAIN> Time service returned error : ${err}`));
    
    // Create the exposed instance (server-side)
    const timeServiceImpl = new TimeServiceImpl2();
    
    // Create and start the service (server-side)
    const timeService = ipcBusModule.CreateIpcBusService(ipcBusClient, 'time', timeServiceImpl);
    timeService.start();
    setTimeout(() => {
        console.log('<MAIN Service> Check that event is not published on the bus when the service is stopped');
        timeService.stop();
        timeServiceImpl.emit('not_emitted_event', {});
        setTimeout(() => {
            console.log('<MAIN Service> Check that event is published on the bus when the service is started');
            timeService.start();
            timeServiceImpl.emit('emitted_event', {});
        }, 1000);
    }, 2000);

    new MainProcess();
}

function prepareApp() {
    ipcBridge = ipcBusModule.CreateIpcBusBridge(busPath);
    ipcBridge.start()
        .then((msg) => {
            console.log('<MAIN> IPC bridge is ready !');
            // Setup IPC Client (and renderer bridge)
            ipcBusClient.connect('MainBus')
                .then(() => startApp());
        });
}

// Startup
electronApp.on('ready', function () {
    var bLocalBrokerState = true;

    console.log('<MAIN> Starting IPC broker ...');
    if (bLocalBrokerState) {
        // Broker in Master process
        ipcBroker = ipcBusModule.CreateIpcBusBroker(busPath);
        ipcBroker.start()
            .then((msg) => {
                console.log('<MAIN> IPC broker is ready !');
                prepareApp();
            })
            .catch((err) => {
                console.log("IPC Broker instance : " + err);
            });
    } else {
        // Setup Remote Broker
        ipcBrokerProcess = spawnNodeInstance('BrokerNodeInstance.js');
        ipcBrokerProcess.on('message', function (msg) {
            console.log('<MAIN> IPC broker is ready !');
            prepareApp();
        });
        // ipcBrokerProcess.stdout.addListener('data', data => { console.log('<BROKER> ' + data.toString()); });
        // ipcBrokerProcess.stderr.addListener('data', data => { console.log('<BROKER> ' + data.toString()); });
    }
});

