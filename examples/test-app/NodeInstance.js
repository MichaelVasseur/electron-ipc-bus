//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Electron Test App

'use strict';

console.log('Starting Node instance ...')

// Node
const util = require('util');
const path = require('path');
const child_process = require('child_process');

const ipcBusModule = require('electron-ipc-bus');
const ipcBus = ipcBusModule.CreateIpcBus();
ipcBusModule.ActivateIpcBusTrace(true);

const peerName = 'Node_' + process.pid;

function onTopicMessage(topicName, topicMsg, topicPeerName, requestResolveCB, rejectResolveCB) {
    console.log('node - onTopicMessage topic:' + topicName + ' data:' + topicMsg);
    var msgJSON = {
        action: 'receivedSend',
        args: { topic : topicName, msg : topicMsg, peerName: topicPeerName}
    };
    if (requestResolveCB) {
        var autoReply = topicName + ' - AutoReply from #' + peerName;
        requestResolveCB(autoReply);
        console.log(autoReply);
    }
    process.send(JSON.stringify(msgJSON));
}

function doSubscribeTopic(msgJSON) {
    var topicName = msgJSON['topic'];
    console.log('node - doSubscribeTopic:' + topicName);
    ipcBus.subscribe(topicName, onTopicMessage);
    process.send(JSON.stringify(msgJSON));
}

function doUnsubscribeTopic(msgJSON) {
    var topicName = msgJSON['topic'];
    console.log('node - doUnsubscribeTopic:' + topicName);
    ipcBus.unsubscribe(topicName, onTopicMessage);
    process.send(JSON.stringify(msgJSON));
}

function doSendOnTopic(msgJSON) {
    var args = msgJSON['args'];
    console.log('node - doSendOnTopic: topicName:' + args['topic'] + ' msg:' + args['msg']);
    ipcBus.send(args['topic'], args['msg']);
    process.send(JSON.stringify(msgJSON));
}

function doRequestOnTopic(msgJSON) {
    var args = msgJSON['args'];
    console.log('node - doRequestOnTopic: topicName:' + args['topic'] + ' msg:' + args['msg']);
    ipcBus.request(args['topic'], args['msg'])
        .then((requestPromiseResponse) => {
            msgJSON['action'] = 'receivedRequestThen';
            msgJSON['requestPromiseResponse'] = requestPromiseResponse;
            process.send(JSON.stringify(msgJSON));
        })
        .catch((requestPromiseResponse) => {
            msgJSON['action'] = 'receivedRequestCatch';
            msgJSON['requestPromiseResponse'] = requestPromiseResponse;
            process.send(JSON.stringify(msgJSON));
        });
}


function doInit(msgJSON) {
    var args = msgJSON['args'];
    console.log('node - doInit: topicName:' + args);
}

function dispatchMessage(msg)
{
    console.log('node - receive message:' + msg);
    if (isConnected == false)
    {
        console.log('node - delay message:' + msg);
        msgs.push(msg);
    }
    else
    {
        var actionFcts =
        {
            subscribe : doSubscribeTopic,
            unsubscribe : doUnsubscribeTopic,
            send : doSendOnTopic,
//            request : doRequestOnTopic,
            request : doRequestOnTopic,
            init : doInit
        };

        console.log('node - execute message:' + msg);
        var msgJSON = JSON.parse(msg);
        if (actionFcts.hasOwnProperty(msgJSON['action']))
        {
            actionFcts[msgJSON['action']](msgJSON);
        }
    }
}

function onIPCBus_TestPerformanceStart(topicName, msgContent, peerName) {
    msgContent.origin = { 
        timeStamp: Date.now,
        type: 'node', 
        peerName: ipcBus.peerName
    }
    ipcBus.send('test-performance-main', msgContent);
    ipcBus.send('test-performance-renderer', msgContent);
}

function onIPCBus_TestPerformance(topicName, msgContent, peerName) {
    msgContent.response = { 
        timeStamp: Date.now(),
        type: 'node', 
        peerName: ipcBus.peerName
    }
    ipcBus.send('test-performance-result', msgContent);
}

var isConnected = false;
var msgs = [];

ipcBus.connect()
    .then(() => {
        console.log('node - connect');
        isConnected = true;
        for(var msg in msgs)
        {
            dispatchMessage(msg);
        }
        msgs = [];
        ipcBus.subscribe('test-performance-start', onIPCBus_TestPerformanceStart);
        ipcBus.subscribe('test-performance-node', onIPCBus_TestPerformance);
});

process.on('message', dispatchMessage);
