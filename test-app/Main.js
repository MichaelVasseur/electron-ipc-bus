//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

// Node
const util = require("util");
const path = require("path");
const child_process = require("child_process");

// Electron 
const electronApp = require("electron").app;
const ipcMain = require("electron").ipcMain;
const BrowserWindow = require("electron").BrowserWindow;

// Debug rules
electronApp.commandLine.appendSwitch('remote-debugging-port', '55555');
electronApp.commandLine.appendSwitch('host-rules', 'MAP * 127.0.0.1');

// Misc
const uuid = require("uuid");
const busPath = '/tr-ipc-bus/' + uuid.v4();
console.log("IPC Bus Path : " + busPath);

// IPC Bus
const ipcBus = require("../electron-ipc-bus")("browser", busPath, ipcMain);


// Load node-import without wrapping to variable. 
require('node-import');
imports("ProcessConnector");

// Helpers
function spawnNodeInstance(scriptPath) {

    const args = [path.join(__dirname, scriptPath), '--parent-pid=' + process.pid, '--bus-path=' + busPath]

    let options = { env: {} };
    for (let key of Object.keys(process.env)) {
        options.env[key] = process.env[key];
    }

    options.env['ELECTRON_RUN_AS_NODE'] = '1';
    options.stdio = ['pipe', 'pipe', 'pipe', 'ipc'];
    return child_process.spawn(process.argv[0], args, options);
}


var processId = 0;

function startMainInstance() {
    var processMainFromView = new ProcessConnector("main", ipcMain);
    processMainFromView.onSendMessage(onIPCElectron_SendMessage);
    processMainFromView.onSubscribe(onIPCElectron_Subscribe);
    processMainFromView.onUnsubscribe(onIPCElectron_Unsubscribe);

    var preloadFile = path.join(__dirname, "BundledBrowserWindowPreload.js");
    const mainWindow = new BrowserWindow({
        width: 800, height: 600,
        webPreferences:
        {
            preload: preloadFile
        }
    });
    mainWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));

    var processMainToView = new ProcessConnector("main", mainWindow.webContents);
    mainWindow.webContents.on('dom-ready',  function () {
        mainWindow.webContents.send("initializeWindow", { title: "Main", type: "main" });
    });

    function onIPCElectron_ReceivedMessage(topicName, topicMsg) {
        console.log("Master - onIPCElectron_ReceivedMessage - topic:" + topicName + " data:" + topicMsg);
        processMainToView.receivedMessageNotify(topicName, topicMsg);
    }

    function onIPCElectron_Subscribe(topicName) {
        console.log("Master - onIPCElectron_Subscribe:" + topicName);
        ipcBus.subscribe(topicName, onIPCElectron_ReceivedMessage);
        processMainToView.sendSubscribeNotify(topicName);
    }

    function onIPCElectron_Unsubscribe(topicName) {
        console.log("Master - onIPCElectron_Subscribe:" + topicName);
        ipcBus.unsubscribe(topicName, onIPCElectron_ReceivedMessage);
        processMainToView.sendUnsubscribeNotify(topicName);
    }

    function onIPCElectron_SendMessage(topicName, topicMsg) {
        console.log("Master - onIPCElectron_SendMessage : topic:" + topicName + " msg:" + topicMsg);
        ipcBus.send(topicName, topicMsg);
    }
}

function startRendererInstance() {
    var preloadFile = path.join(__dirname, "BundledBrowserWindowPreload.js");
    const rendererWindow = new BrowserWindow({
        width: 800, height: 600,
        webPreferences:
        {
            preload: preloadFile
        }
    });
    rendererWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));
    (function (processId) {
        rendererWindow.webContents.on('dom-ready', function () {
            rendererWindow.webContents.send("initializeWindow", { title: "Renderer", type: "renderer", id: processId });
        });
    })(processId);
    ++processId;
}

const nodeInstances = new Map;

// Classes

function NodeInstance() {

    this.process = spawnNodeInstance("NodeInstance.js");
    this.process.stdout.addListener("data", data => { console.log('<NODE> ' + data.toString()); });
    this.process.stderr.addListener("data", data => { console.log('<NODE> ' + data.toString()); });
    console.log("<MAIN> Node instance #" + this.process.pid + " started !")

    this.term = function () {

        this.process.kill();
        this.window.close();
    }
}

function startNodeInstance() {
    var processMainFromView = new ProcessConnector("node", processId, ipcMain);
    processMainFromView.onSendMessage(onIPCElectron_SendMessage);
    processMainFromView.onSubscribe(onIPCElectron_Subscribe);
    processMainFromView.onUnsubscribe(onIPCElectron_Unsubscribe);

    var nodeInstance = new NodeInstance();
    nodeInstance.process.send(JSON.stringify({ action: "init", args: { title: "Node", type: "node", id: processId } }));
    var preloadFile = path.join(__dirname, "BundledBrowserWindowPreload.js");
    const nodeWindow = new BrowserWindow({
        width: 800, height: 600,
        webPreferences:
        {
            preload: preloadFile
        }
    });
    var processMainToView = new ProcessConnector("node", processId, nodeWindow.webContents);
    nodeWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));
    (function (processId) {
        nodeWindow.webContents.on('dom-ready', function () {
            nodeWindow.webContents.send("initializeWindow", { title: "Node", type: "node", id: processId });
        });
    })(processId);

    nodeInstances.set(processId, nodeInstance);
    ++processId;

    function onIPCElectron_ReceivedMessage(topicName, topicMsg) {
        console.log("Master - onIPCElectron_ReceivedMessage - topic:" + topicName + " data:" + topicMsg);
        processMainToView.receivedMessageNotify(topicName, topicMsg);
    }

    function onIPCElectron_Subscribe(topicName) {
        console.log("Node - onIPCElectron_Subscribe:" + topicName);
        var msgJSON =
            {
                action: "subscribe",
                topic: topicName
            };
        nodeInstance.process.send(JSON.stringify(msgJSON));
        processMainToView.sendSubscribeNotify(topicName);
    }

    function onIPCElectron_Unsubscribe(topicName) {
        console.log("Node - onIPCElectron_Subscribe:" + topicName);
        var msgJSON =
            {
                action: "unsubscribe",
                topic: topicName
            };
        nodeInstance.process.send(JSON.stringify(msgJSON));
        processMainToView.sendUnsubscribeNotify(topicName);
    }

    function onIPCElectron_SendMessage(topicName, topicMsg) {
        console.log("Node - onIPCElectron_SendMessage : topic:" + topicName + " msg:" + topicMsg);
        var msgJSON =
            {
                action: "send",
                args: args
            };
        nodeInstance.process.send(JSON.stringify(msgJSON));
    }
}


// Commands

function doTermInstance(pid) {

    console.log("<MAIN> Killing instance #" + pid + " ...");
    const nodeInstance = nodeInstances.find((e) => e.process.pid == pid);
    const instanceIdx = nodeInstances.indexOf(nodeInstance);
    nodeInstances.splice(instanceIdx, 1);
    nodeInstance.term();
}

// Startup
let ipcBrokerInstance = null

electronApp.on("ready", function () {

    // Setup IPC Broker
    console.log("<MAIN> Starting IPC broker ...");
    ipcBrokerInstance = spawnNodeInstance("BrokerNodeInstance.js");
    ipcBrokerInstance.on("message", function (msg) {

        console.log("<MAIN> IPC broker is ready !");
        // Setup IPC Client (and renderer bridge)
        ipcBus.connect(function () {

            // Command hanlers
            ipcBus.subscribe("ipc-tests/new-node-instance", () => doNewNodeInstance());
            ipcBus.subscribe("ipc-tests/new-htmlview-instance", (event, pid) => doNewHtmlViewInstance());

            startMainInstance();
            startRendererInstance();
            startNodeInstance();
        })
    })
    ipcBrokerInstance.stdout.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
    ipcBrokerInstance.stderr.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
});

