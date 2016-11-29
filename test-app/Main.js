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
const ipcBus = require("ipc-bus")("browser", busPath, ipcMain);

// Helpers

function getCmdLineArgValue(argName) {
    
    for(let i = 0; i < process.argv.length; i++) {
            
        if(process.argv[i].startsWith("--" + argName))
        {
            const argValue = process.argv[i].split("=")[1];
            return argValue;
        }
    }
    return null;
}

function startNodeInstance(scriptPath) {

    const args = [ path.join(__dirname, scriptPath), '--parent-pid=' + process.pid, '--bus-path=' + busPath]

    let options = { env: {} };
    for (let key of Object.keys(process.env)) {
        options.env[key] = process.env[key];
    }

    options.env['ELECTRON_RUN_AS_NODE'] = '1';
    options.stdio = ['pipe', 'pipe', 'pipe', 'ipc'];
    return child_process.spawn(process.argv[0], args, options);
}

// Classes

const nodeInstances = []

function NodeInstance() {

    this.process = startNodeInstance("NodeInstance.js");
    this.process.stdout.addListener("data", data => { console.log('<NODE> ' + data.toString()); });
    this.process.stderr.addListener("data", data => { console.log('<NODE> ' + data.toString()); });
    console.log("<MAIN> Node instance #" + this.process.pid + " started !")

    nodeInstances.push(this);

    this.term = function() {

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

function onTopicMessage(topic, data) {
    console.log("master - topic:" + topic + " data:" + data);
    ipcBus.send("ipc-tests/master-received-topic", { "topic" : topic, "msg" : data});
}

function doSubscribeTopic(topic) {
    console.log("master - doSubscribeTopic:" + topic);
    ipcBus.subscribe(topic, onTopicMessage);
}

function doUnsubscribeTopic(topic) {
    console.log("master - doUnsubscribeTopic:" + topic);
    ipcBus.unsubscribe(topic, onTopicMessage);
}

function doSendOnTopic(args) {
    console.log("master - doSendOnTopic: topic:" + args["topic"] + " msg:" + args["msg"]);
    ipcBus.send(args["topic"], args["msg"]);
}


function doNodeSubscribeTopic(topic) {
    console.log("master - send to node subscribe:" + topic);

    var msgJSON = 
    { 
        "action":"subscribe",
        "topic":topic
    };
    nodeInstance.process.send(JSON.stringify(msgJSON));
}

function doNodeUnsubscribeTopic(topic) {
    console.log("master - send to node unsubscribe:" + topic);
    var msgJSON = 
    { 
        "action":"unsubscribe",
        "topic":topic
    };
    nodeInstance.process.send(JSON.stringify(msgJSON));
}

function doNodeSendOnTopic(args) {
    console.log("master - send to node send:" + args);
    var msgJSON = 
    { 
        "action":"send",
        "args":args
    };
    nodeInstance.process.send(JSON.stringify(msgJSON));
}


// Startup

let ipcBrokerInstance = null
var nodeInstance = null;

electronApp.on("ready", function () {

//    ipcMain.on("ipc-tests/ipc-master-unsubscribe", (event, topic) => doUnsubscribeMainTopic(topic));
//    ipcMain.on("ipc-tests/ipc-master-subscribe", (event, topic) => doSubscribeTopic(topic));
//    ipcMain.on("ipc-tests/ipc-master-send", (event, args) => doSendMainTopic(args));

    // Setup IPC Broker
    console.log("<MAIN> Starting IPC broker ...");
    ipcBrokerInstance = startNodeInstance("BrokerNodeInstance.js");
    ipcBrokerInstance.on("message", function (msg) {

        console.log("<MAIN> IPC broker is ready !");
        // Setup IPC Client (and renderer bridge)
        ipcBus.connect(function () {

            // Command hanlers
            ipcBus.subscribe("ipc-tests/new-node-instance", () => doNewNodeInstance());
            ipcBus.subscribe("ipc-tests/new-htmlview-instance", (event, pid) => doNewHtmlViewInstance());
            ipcBus.subscribe("ipc-tests/kill-node-instance", (event, pid) => doKillNodeInstance(pid));

            ipcBus.subscribe("ipc-tests/master-subscribe-topic", (event, topic) => doSubscribeTopic(topic));
            ipcBus.subscribe("ipc-tests/master-unsubscribe-topic", (event, topic) => doUnsubscribeTopic(topic));
            ipcBus.subscribe("ipc-tests/master-send-topic", (event, args) => doSendOnTopic(args));

            ipcBus.subscribe("ipc-tests/node-subscribe-topic", (event, topic) => doNodeSubscribeTopic(topic));
            ipcBus.subscribe("ipc-tests/node-unsubscribe-topic", (event, topic) => doNodeUnsubscribeTopic(topic));
            ipcBus.subscribe("ipc-tests/node-send-topic", (event, args) => doNodeSendOnTopic(args));

            // Open main window
            const mainWindow = new BrowserWindow({ width: 800, height: 900, webPreferences: { sandbox: true } })
            mainWindow.loadURL("file://" + path.join(__dirname, "RendererView.html"));

            nodeInstance = new NodeInstance();
        })
    })
    ipcBrokerInstance.stdout.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
    ipcBrokerInstance.stderr.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
});

