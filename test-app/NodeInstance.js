//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

"use strict";

console.log("Starting Node instance ...")

// Node
const util = require("util");
const path = require("path");
const child_process = require("child_process");

const ipcClient = require("electron-ipc-bus")()

function doSubscribeTopic(data) {

    ipcClient.subscribe(data.topic)
}

ipcClient.connect(function() {

    //ipcClient.subscribe("ipc-tests/node-instance/" + process.pid + "/subscribe-topic", function(data) {

    //    ipcClient.subscribe(data.topic)
    //})

    ipcClient.subscribe("ipc-tests-main", function(topic, content) {
        console.log("Received message on '" + topic + "' !");
    });
})