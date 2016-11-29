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
const busPath = '/electron-ipc-bus/' + uuid.v4();
console.log("IPC Bus Path : " + busPath);

// IPC Bus
const ipcClient = require("../main")("main", require("../main")("bus-uuid"));

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

    this.window = new BrowserWindow({ width: 800, height: 600, webPreferences: { sandbox: true }, instancePid: this.process.pid })
    this.window.loadURL("file://" + __dirname + "/NodeInstanceView.html");

    nodeInstances.push(this);

    this.term = function() {

        this.process.kill();
        this.window.close();
    }
}

// Commands

function doNewNodeInstance() {

    console.log("<MAIN> Starting new Node instance ...")
    const instance = new NodeInstance();
}

function doTermInstance(pid) {

    console.log("<MAIN> Killing instance #" + pid + " ...");
    const nodeInstance = nodeInstances.find((e) => e.process.pid == pid);
    const instanceIdx = nodeInstances.indexOf(nodeInstance);
    nodeInstances.splice(instanceIdx, 1);
    nodeInstance.term();
}

function onMainTopicMessage(topic, data) {

}

function doSubscribeMainTopic(topic) {

    ipcClient.subscribe(topic, onMainTopicMessage);
}

function doUnsubscribeMainTopic(topic) {

    ipcClient.unsubscribe(topic, onMainTopicMessage);
}

// Startup

let ipcBrokerInstance = null

electronApp.on("ready", function () {

    // Setup IPC Broker
    console.log("<MAIN> Starting IPC broker ...");
    ipcBrokerInstance = startNodeInstance("BrokerNodeInstance.js");
    ipcBrokerInstance.on("message", function (msg) {

        console.log("<MAIN> IPC broker is ready !");
        // Setup IPC Client (and renderer bridge)
        ipcClient.connect(function () {

            console.log("<MAIN> Connected to IPC broker !");

            ipcClient.subscribe("IPC_BUS_BROKER_STATUS_TOPIC", function(topic, brokerState) {
                console.log(topic + " = " + util.inspect(brokerState));
            });

            // Command hanlers
            ipcClient.subscribe("ipc-tests/new-node-instance", () => doNewNodeInstance());
            //ipcClient.subscribe("ipc-tests/kill-node-instance", (event, pid) => doKillNodeInstance(pid));
            //ipcClient.subscribe("ipc-tests/subscribe-main-topic", (event, topic) => doSubscribeMainTopic(topic));
            //ipcClient.subscribe("ipc-tests/unsubscribe-main-topic", (event, topic) => doUnsubscribeMainTopic(topic));

            // Open main window
            const preloadPath = path.join(__dirname, "BundledBrowserWindowPreload.js")
            console.log("Preload : " + preloadPath)
            const mainWindow = new BrowserWindow({ width: 800, height: 600, webPreferences: { sandbox: false, preload: preloadPath } })
            mainWindow.loadURL("file://" + path.join(__dirname, "Main.html"));

            setTimeout(function(){
                ipcClient.subscribe("ipc-tests-main", function(topic, content) {
                    console.log("<MAIN> Received message on '" + topic + "' !");
                });
                console.log("There is " + ipcClient.listenerCount("ipc-tests-main") + " listeners on 'ipc-tests-main'");
                ipcClient.send("ipc-tests-main");
                //mainWindow.webContents.send("IPC_BUS_RENDERER_RECEIVE", "ipc-tests-main");

                //console.log("<MAIN> Manual emit of 'ipc-tests-main'");
                //ipcClient.emit("ipc-tests-main");

                ipcClient.queryBrokerState();
            }, 3000);


        })
    })
    ipcBrokerInstance.stdout.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
    ipcBrokerInstance.stderr.addListener("data", data => { console.log('<BROKER> ' + data.toString()); });
});

