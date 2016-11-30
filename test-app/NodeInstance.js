//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

console.log("Starting Node instance ...")

// Node
const util = require("util");
const path = require("path");
const child_process = require("child_process");
const Module = require("module")

// Override module loading
const originalResolveFilename = Module._resolveFilename
const newResolveFilename = function (request, parent, isMain) {

    switch (request) {
        case 'ipc-bus':
            return originalResolveFilename(path.join(path.dirname(process.argv0), "resources", "electron.asar", "common", "api", "ipc-bus.js"), parent, isMain)
        default:
            return originalResolveFilename(request, parent, isMain)
    }
}

Module._resolveFilename = newResolveFilename;

const ipcBus = require("ipc-bus")()

function onTopicMessage(topic, data) {
    console.log("node - topic:" + topic + " data:" + data);
    ipcBus.send("ipc-tests/node-received-topic", { "topic" : topic, "msg" : data});
}

function doSubscribeTopic(topic) {
    console.log("node - doSubscribeTopic:" + topic);
    ipcBus.subscribe(topic, onTopicMessage);
}

function doUnsubscribeTopic(topic) {
    console.log("node - doUnsubscribeTopic:" + topic);
    ipcBus.unsubscribe(topic, onTopicMessage);
}

function doSendOnTopic(args) {
    console.log("node - doSendOnTopic: topic:" + args["topic"] + " msg:" + args["msg"]);
    ipcBus.send(args["topic"], args["msg"]);
}

function dispatchMessage(msg)
{
    console.log("node - receive message:" + msg);
    if (isConnected == false)
    {
        console.log("node - delay message:" + msg);
        msgs.push(msg);
    }
    else
    {
        console.log("node - execute message:" + msg);
        var msgJSON = JSON.parse(msg);
        if (msgJSON["action"] == "subscribe")
        {
            doSubscribeTopic(msgJSON["topic"]);
        }
        if (msgJSON["action"] == "unsubscribe")
        {
            doUnsubscribeTopic(msgJSON["topic"]);
        }
        if (msgJSON["action"] == "send")
        {
            doSendOnTopic(msgJSON["args"]);
        }
    }
}


var isConnected = false;
var msgs = [];

ipcBus.connect(function () {
    isConnected = true;
    for(var msg in msgs)
    {
        dispatchMessage(msg);
    }
    msgs = [];
})

process.on("message", dispatchMessage);