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

function startMasterInstance()
{
    var processMasterFromView = new ProcessConnector("master", ipcMain);
    processMasterFromView.onSendMessage(onIPCElectron_MasterSendMessage);
    processMasterFromView.onSubscribe(onIPCElectron_MasterSubscribe);
    processMasterFromView.onUnsubscribe(onIPCElectron_MasterUnsubscribe);

    var preloadFile = path.join(__dirname, "BundledBrowserWindowPreload.js");
    const mainWindow = new BrowserWindow({
        width: 800, height: 600,
        webPreferences:
        {
            preload: preloadFile
        }
    });
    mainWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));

    var processMasterToView = new ProcessConnector("master", mainWindow.webContents);
    mainWindow.webContents.on('dom-ready', () => {
        mainWindow.webContents.send("initializeWindow", { title: "Master", type: "master" });
    });

    function onIPCElectron_ReceivedMessage(topicName, topicMsg) {
        console.log("onIPCElectron_ReceivedMessage - topic:" + topicName + " data:" + topicMsg);
        processMasterToView.receivedMessageNotify(topicName, topicMsg);
    }

    function onIPCElectron_MasterSubscribe(topicName) {
        console.log("onIPCElectron_MasterSubscribe:" + topicName);
        ipcBus.subscribe(topicName, onIPCElectron_ReceivedMessage);
        processMasterToView.sendSubscribeNotify(topicName);
    }

    function onIPCElectron_MasterUnsubscribe(topicName) {
        console.log("onIPCElectron_MasterSubscribe:" + topicName);
        ipcBus.unsubscribe(topicName, onIPCElectron_ReceivedMessage);
        processMasterToView.sendUnsubscribeNotify(topicName);
    }

    function onIPCElectron_MasterSendMessage(topicName, topicMsg) {
        console.log("onIPCElectron_MasterSendMessage : topic:" + topicName + " msg:" + topicMsg);
        ipcBus.send(topicName, topicMsg);
    }
}

function startRendererInstance()
{
    var preloadFile = path.join(__dirname, "BundledBrowserWindowPreload.js");
    const rendererWindow = new BrowserWindow({
        width: 800, height: 600,
        webPreferences:
        {
            preload: preloadFile
        }
    });
    rendererWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));
    rendererWindow.webContents.on('dom-ready', () => {
        rendererWindow.webContents.send("initializeWindow", { title: "Renderer", type: "renderer", id: processId });
    });
    ++processId;
}

function startNodeInstance()
{
    var nodeInstance = new NodeInstance();
    nodeInstance.process.send(JSON.stringify({action:"init", args:{ title: "Node", type: "node", id: processId }}));
    var preloadFile = path.join(__dirname, "BundledBrowserWindowPreload.js");
    const nodeWindow = new BrowserWindow({
        width: 800, height: 600,
        webPreferences:
        {
            preload: preloadFile
        }
    });
    nodeWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));
    nodeWindow.webContents.on('dom-ready', () => {
        rendererWindow.webContents.send("initializeWindow", { title: "Node", type: "node", id: processId });
    });
    ++processId;
}

const nodeInstances = new Map;

// Classes

function NodeInstance() {

    this.process = spawnNodeInstance("NodeInstance.js");
    this.process.stdout.addListener("data", data => { console.log('<NODE> ' + data.toString()); });
    this.process.stderr.addListener("data", data => { console.log('<NODE> ' + data.toString()); });
    console.log("<MAIN> Node instance #" + this.process.pid + " started !")

    nodeInstances.push(this);

    this.term = function () {

        this.process.kill();
        this.window.close();
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


function doNodeSubscribeTopic(topic) {
    console.log("master - send to node subscribe:" + topic);

    var msgJSON =
        {
            action: "subscribe",
            topic: topic
        };
    nodeInstance.process.send(JSON.stringify(msgJSON));
}

function doNodeUnsubscribeTopic(topic) {
    console.log("master - send to node unsubscribe:" + topic);
    var msgJSON =
        {
            action: "unsubscribe",
            topic: topic
        };
    nodeInstance.process.send(JSON.stringify(msgJSON));
}

function doNodeSendOnTopic(args) {
    console.log("master - send to node send:" + args);
    var msgJSON =
        {
            action: "send",
            args: args
        };
    nodeInstance.process.send(JSON.stringify(msgJSON));
}


// Startup

let ipcBrokerInstance = null
var nodeInstance = null;

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

            startMasterInstance();
            startRendererInstance();
        })
    })
    ipcBrokerInstance.stdout.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
    ipcBrokerInstance.stderr.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
});

