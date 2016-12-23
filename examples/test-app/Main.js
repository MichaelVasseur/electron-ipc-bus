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
electronApp.commandLine.appendSwitch("remote-debugging-port", "55555");
electronApp.commandLine.appendSwitch("host-rules", "MAP * 127.0.0.1");

// Misc
const uuid = require("uuid");
const busPath = "/tr-ipc-bus/" + uuid.v4();
console.log("IPC Bus Path : " + busPath);

// IPC Bus
const ipcBusModule = require("electron-ipc-bus");
// const ipcBus = ipcBusModule.CreateIpcBusForClient("browser", busPath);
const ipcBus = ipcBusModule.CreateIpcBus(busPath);

// Load node-import without wrapping to variable. 
require("node-import");
imports("ProcessConnector");

// Helpers
function spawnNodeInstance(scriptPath) {
    const args = [path.join(__dirname, scriptPath), "--parent-pid=" + process.pid, "--bus-path=" + busPath];

    let options = { env: {} };
    for (let key of Object.keys(process.env)) {
        options.env[key] = process.env[key];
    }

    options.env["ELECTRON_RUN_AS_NODE"] = "1";
    options.stdio = ["pipe", "pipe", "pipe", "ipc"];
    return child_process.spawn(process.argv[0], args, options);
}

// Window const
var preloadFile = path.join(__dirname, "BundledBrowserWindowPreload.js");
var width = 900;

var MainProcess = (function () {
    function MainProcess() {
        var processId = 0;
        var instances = new Map;

        // Listen view messages
        var processMainFromView = new ProcessConnector("main", ipcMain);
        processMainFromView.onRequestMessage(onIPCElectron_RequestMessage);
        processMainFromView.onSendMessage(onIPCElectron_SendMessage);
        processMainFromView.onSubscribe(onIPCElectron_Subscribe);
        processMainFromView.onUnsubscribe(onIPCElectron_Unsubscribe);
        processMainFromView.on("new-process", doNewProcess);

        const mainWindow = new BrowserWindow({
            width: width, height: 800,
            webPreferences:
            {
                preload: preloadFile
            }
        });
        mainWindow.on("close", function () {
            instances.forEach(function (value, key, map) {
                value.term();
            });
            instances.clear();
        });

        mainWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));

        var processMainToView = new ProcessConnector("main", mainWindow.webContents);
        mainWindow.webContents.on("dom-ready", function () {
            mainWindow.webContents.send("initializeWindow", { title: "Main", type: "main", peerName: "Master", webContentsId: mainWindow.webContents.id });
        });

        function doNewProcess(processType) {
            var newProcess = null;
            switch (processType) {
                case "renderer":
                    newProcess = new RendererProcess(processId);
                    break;
                case "node":
                    newProcess = new NodeProcess(processId);
                    break;
            }
            if (newProcess != null) {
                instances.set(processId, newProcess);
                newProcess.onClose(function (processId) {
                    instances.delete(processId);
                });
                ++processId;
            }
        }

        function onIPCElectron_ReceivedMessage(topicName, topicMsg, topicToReply) {
            console.log("Master - onIPCElectron_ReceivedMessage - topic:" + topicName + " data:" + topicMsg);
            processMainToView.receivedSendNotify(topicName, topicMsg, topicToReply);
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

        function onIPCElectron_RequestMessage(topicName, topicMsg) {
            console.log("Master - onIPCElectron_SendMessage : topic:" + topicName + " msg:" + topicMsg);
            ipcBus.request(topicName, topicMsg, function (topic, content, peerName) {
                processMainToView.receivedRequestNotify(topic, topicMsg, content, peerName);
            });
        }

    }
    return MainProcess;
})();

var RendererProcess = (function () {
    function RendererProcess(processId) {
        const rendererWindow = new BrowserWindow({
            width: width, height: 600,
            webPreferences:
            {
                preload: preloadFile
            }
        });
        rendererWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));
        rendererWindow.webContents.on("dom-ready", function () {
            rendererWindow.webContents.send("initializeWindow", { title: "Renderer", type: "renderer", id: processId, peerName: "Renderer_" + rendererWindow.webContents.id, webContentsId: rendererWindow.webContents.id });
        });

        this.onClose = function _onClose(callback) {
            rendererWindow.on("close", function () {
                callback(processId);
            });
        };

        this.term = function _term() {
            rendererWindow.close();
        };
    };
    return RendererProcess;
})();

// Classes
var NodeProcess = (function () {

    function NodeInstance() {
        this.process = spawnNodeInstance("NodeInstance.js");
        this.process.stdout.addListener("data", data => { console.log("<NODE> " + data.toString()); });
        this.process.stderr.addListener("data", data => { console.log("<NODE> " + data.toString()); });
        console.log("<MAIN> Node instance #" + this.process.pid + " started !");
    }

    function NodeProcess(processId) {
        var nodeInstance = new NodeInstance();
        // Listen view messages
        var processMainFromView = new ProcessConnector("node", processId, ipcMain);
        processMainFromView.onRequestMessage(onIPCElectron_RequestMessage);
        processMainFromView.onSendMessage(onIPCElectron_SendMessage);
        processMainFromView.onSubscribe(onIPCElectron_Subscribe);
        processMainFromView.onUnsubscribe(onIPCElectron_Unsubscribe);

        // Listen node message
        nodeInstance.process.on("message", onIPCProcess_Message);

        nodeInstance.process.send(JSON.stringify({ action: "init", args: { title: "Node", type: "node", id: processId } }));
        const nodeWindow = new BrowserWindow({
            width: width, height: 600,
            webPreferences:
            {
                preload: preloadFile
            }
        });
        var processMainToView = new ProcessConnector("node", processId, nodeWindow.webContents);
        nodeWindow.loadURL("file://" + path.join(__dirname, "CommonView.html"));
        nodeWindow.on("close", function () {
            nodeInstance.process.kill();
        });
        nodeWindow.webContents.on("dom-ready", function () {
            nodeWindow.webContents.send("initializeWindow", { title: "Node", type: "node", id: processId, peerName: "Node_" + nodeInstance.process.pid, webContentsId: nodeWindow.webContents.id });
        });

        this.term = function _term() {
            nodeWindow.close();
        };

        this.onClose = function _onClose(callback) {
            nodeWindow.on("close", function () {
                callback(processId);
            });
        };

        function onIPCProcess_Message(data) {
            var msgJSON = JSON.parse(data);
            if (msgJSON.hasOwnProperty("action")) {
                switch (msgJSON["action"]) {
                    case "receivedRequest":
                        processMainToView.receivedRequestNotify(msgJSON["args"]["topic"], msgJSON["args"]["msg"], msgJSON["args"]["response"], msgJSON["args"]["peerName"]);
                        break;
                    case "receivedSend":
                        processMainToView.receivedSendNotify(msgJSON["args"]["topic"], msgJSON["args"]["msg"], msgJSON["args"]["topicToReply"]);
                        break;
                    case "subscribe":
                        processMainToView.sendSubscribeNotify(msgJSON["topic"]);
                        break;
                    case "unsubscribe":
                        processMainToView.sendUnsubscribeNotify(msgJSON["topic"]);
                        break;
                }
            }
        };

        function onIPCElectron_Subscribe(topicName) {
            console.log("Node - onIPCElectron_Subscribe:" + topicName);
            var msgJSON = {
                    action: "subscribe",
                    topic: topicName
                };
            nodeInstance.process.send(JSON.stringify(msgJSON));
        };

        function onIPCElectron_Unsubscribe(topicName) {
            console.log("Node - onIPCElectron_Subscribe:" + topicName);
            var msgJSON = {
                    action: "unsubscribe",
                    topic: topicName
                };
            nodeInstance.process.send(JSON.stringify(msgJSON));
            processMainToView.sendUnsubscribeNotify(topicName);
        };

        function onIPCElectron_RequestMessage(topicName, topicMsg) {
            console.log("Node - onIPCElectron_RequestMessage : topic:" + topicName + " msg:" + topicMsg);
            var msgJSON = {
                    action: "request",
                    args: { topic: topicName, msg: topicMsg }
                };
            nodeInstance.process.send(JSON.stringify(msgJSON));
        };

        function onIPCElectron_SendMessage(topicName, topicMsg) {
            console.log("Node - onIPCElectron_SendMessage : topic:" + topicName + " msg:" + topicMsg);
            var msgJSON = {
                    action: "send",
                    args: { topic: topicName, msg: topicMsg }
                };
            nodeInstance.process.send(JSON.stringify(msgJSON));
        };
    }

    return NodeProcess;

})();
// Startup
let ipcBrokerInstance = null;

electronApp.on("ready", function () {

    // Setup IPC Broker
    console.log("<MAIN> Starting IPC broker ...");
    ipcBrokerInstance = spawnNodeInstance("BrokerNodeInstance.js");
    ipcBrokerInstance.on("message", function (msg) {

        console.log("<MAIN> IPC broker is ready !");
        // Setup IPC Client (and renderer bridge)
        ipcBus.connect(function () {
            new MainProcess();
        });
    });
    ipcBrokerInstance.stdout.addListener("data", data => { console.log("<BROKER> " + data.toString()); });
    ipcBrokerInstance.stderr.addListener("data", data => { console.log("<BROKER> " + data.toString()); });
});

