'use strict'

// Common modules
const os = require('os')
const path = require('path')
const util = require('util')
const EventEmitter = require('events').EventEmitter
const Module = require('module')
const uuid = require("uuid")

// Constants
const IPC_BUS_RENDERER_SUBSCRIBE = 'IPC_BUS_RENDERER_SUBSCRIBE'
const IPC_BUS_RENDERER_SEND = 'IPC_BUS_RENDERER_SEND'
const IPC_BUS_RENDERER_REQUEST = 'IPC_BUS_RENDERER_REQUEST'
const IPC_BUS_RENDERER_UNSUBSCRIBE = 'IPC_BUS_RENDERER_UNSUBSCRIBE'
const IPC_BUS_RENDERER_RECEIVE = 'IPC_BUS_RENDERER_RECEIVE'
const IPC_BUS_RENDERER_QUERYSTATE = 'IPC_BUS_RENDERER_QUERYSTATE'

const IPC_BUS_COMMAND_SUBSCRIBETOPIC = 'subscribeTopic'
const IPC_BUS_COMMAND_UNSUBSCRIBETOPIC = 'unsubscribeTopic'
const IPC_BUS_COMMAND_SENDMESSAGE = 'sendMessage'
const IPC_BUS_COMMAND_REQUESTMESSAGE = 'requestMessage'
const IPC_BUS_COMMAND_QUERYSTATE = 'queryState'
const IPC_BUS_EVENT_SENDMESSAGE = 'onSendMessage'
const IPC_BUS_EVENT_REQUESTMESSAGE = 'onRequestMessage'

const BASE_IPC_MODULE = 'easy-ipc'

function MapRefCount() {
    let topicMap = new Map

    this.AddRef = function _AddRef(topic, conn, peerName, callback) {
        console.log("[MapRefCount] AddRef : " + topic + "  : conn " + conn)

        let connMap = topicMap.get(topic)
        if (connMap === undefined) {
            connMap = new Map()
            // This topic has NOT been subscribed yet, add it to the map
            topicMap.set(topic, connMap)
            console.log("[MapRefCount] AddRef : topic '" + topic + "' is added")
        }
        let peerNameMap = connMap.get(conn)
        if (peerNameMap === undefined) {
            // This topic has NOT been already subscribed by this connection
            peerNameMap = new Map
            connMap.set(conn, peerNameMap)
            console.log("[MapRefCount] AddRef : conn '" + conn + "' is added")
        }
        let count = peerNameMap.get(peerName)
        if (count === undefined) {
            // This topic has NOT been already subcribed by this peername, by default 1
            count = 1
            console.log("[MapRefCount] AddRef : peerName '" + peerName + "' is added")
        }
        else {
            ++count
        }
        peerNameMap.set(peerName, count)
        console.log("[MapRefCount] AddRef : topic '" + topic + "', conn " + conn + ", count = " + peerNameMap.size)
        if (typeof callback === "function") {
            callback(topic, conn, peerName, peerNameMap.size)
        }
    }

    this.Release = function _Release(topic, conn, peerName, callback) {
        console.log("[MapRefCount] Release : " + topic + " conn " + conn)

        let connMap = topicMap.get(topic)
        if (connMap == undefined) {
            console.warn("[MapRefCount] Release : topic '" + topic + "' is unknown")
        }
        else {
            let peerNameMap = connMap.get(conn)
            if (peerNameMap === undefined) {
                console.warn("[MapRefCount] Release : conn '" + conn + "' is unknown")
            }
            else {
                if ((peerName === undefined) || (peerName === null))
                {
                    var peerNamesTemp = []
                    for (let peerName of peerNameMap.keys()) {
                        peerNamesTemp.push(peerName)
                    }
                    for (let peerName of peerNamesTemp) {
                        peerNameMap.delete(peerName)
                        if (typeof callback === "function") {
                            callback(topic, conn, peerName, peerNameMap.size)
                        }
                    }
                }
                else
                {
                    let count = peerNameMap.get(peerName);
                    if (count === undefined) {
                        console.warn("[MapRefCount] Release : peername '" + peerName + "' is unknown")
                    }
                    else {
                        // This connection has subscribed to this topic
                        --count
                        if (count > 0) {
                            peerNameMap.set(peerName, count)
                        } else {
                            // The connection is no more referenced
                            peerNameMap.delete(peerName)
                            console.log("[MapRefCount] Release : peerName '" + peerName + "' is released")
                        }
                    }
                    if (typeof callback === "function") {
                        callback(topic, conn, peerName, peerNameMap.size)
                    }
                }
                if (peerNameMap.size === 0) {
                    connMap.delete(conn)
                    console.log("[MapRefCount] Release : conn '" + conn + "' is released")
                    if (connMap.size === 0) {
                        topicMap.delete(topic)
                        console.log("[MapRefCount] Release : topic '" + topic + "' is released")
                    }
                }
                console.log("[MapRefCount] Release : topic '" + topic + "', conn " + conn + ", count = " + peerNameMap.size)
            }
        }
    }

    this.ReleaseConn = function _ReleaseConn(conn, callback) {
        console.log("[MapRefCount] ReleaseConn : conn " + conn)

        // Store keys in an intermediate array
        // Not sure iterating and removing at the same time is well supported 
        var topicsTmp = []
        for (let topic of topicMap.keys()) {
            topicsTmp.push(topic)
        }
        for (let topic of topicsTmp) {
            this.Release(topic, conn, null, callback)
        }
    }

    this.ForEach = function _ForEach(callback) {
        console.log("[MapRefCount] ForEach")

        if (typeof callback !== "function") {
            console.error("[MapRefCount] ForEach : No callback provided !")
            return;
        }

        topicMap.forEach(function (connMap, topic) {
            callback(connMap, topic)
        });
    }

    this.ForEachTopic = function _ForEachTopic(topic, callback) {
        console.log("[MapRefCount] ForEachTopic : " + topic)

        if (typeof callback !== "function") {
            console.error("[MapRefCount] ForEachTopic : No callback provided !")
            return;
        }

        let connMap = topicMap.get(topic)
        if (connMap == undefined) {
            console.warn("[MapRefCount] ForEachTopic : Unknown topic '" + topic + "' !")
        }
        else {
            connMap.forEach(function (peerNames, conn) {
                console.warn("[MapRefCount] ForEachTopic : '" + topic + "' = " + conn + " (" + peerNames.size + ")")
                callback(peerNames, conn, topic)
            });
        }
    }

    this.ForEachConn = function _ForEachConn(callback) {
        console.log("[MapRefCount] ForEachConn")
        if (typeof callback !== "function") {
            console.error("[MapRefCount] ForEachConn : No callback provided !")
            return;
        }

        topicMap.forEach(function (connMap, topic) {
            connMap.forEach(function (peerNames, conn) {
                callback(peerNames, conn, topic);
            })
        })
    }
}

function _cleanUpConn(ipcbus, conn) {

    // Unsubscribe conn
    ipcbus._subscriptions.ReleaseConn(conn)
}

function _brokerListeningProc(ipcbus, baseIpc, busPath, server) {

    const BaseIpc = require(BASE_IPC_MODULE)

    console.log("[IPCBus:Broker] Listening for incoming connections on '" + busPath + "' ...")

    baseIpc.on('connection', function (conn, server) {

        console.log("[IPCBus:Broker] Incoming connection !")

        conn.on("error", function (err) {

            console.log("[IPCBus:Broker] Error on connection : " + err)
        })
    })

    baseIpc.on('data', function (data, conn, server) {

        if (BaseIpc.Cmd.isCmd(data) == true) {

            switch (data.name) {
                case IPC_BUS_COMMAND_SUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0]
                        const msgPeerName = data.args[1]
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " subscribed to topic '" + msgTopic + "'")
                        ipcbus._subscriptions.AddRef(msgTopic, conn, msgPeerName);
                        break
                    }
                case IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0]
                        const msgPeerName = data.args[1]
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " unsubscribed from topic '" + msgTopic + "'")
                        ipcbus._subscriptions.Release(msgTopic, conn, msgPeerName);
                        break
                    }
                case IPC_BUS_COMMAND_SENDMESSAGE:
                    {
                        const msgTopic = data.args[0]
                        const msgContent = data.args[1]
                        const msgPeerName = data.args[2]
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' from peer #" + msgPeerName)

                        ipcbus._subscriptions.ForEachTopic(msgTopic, function (peerNames, conn, topic) {
                            // Send data to subscribed connections
                            BaseIpc.Cmd.exec(IPC_BUS_EVENT_SENDMESSAGE, topic, msgContent, msgPeerName, conn)
                        })
                        break
                    }
                case IPC_BUS_COMMAND_REQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0];
                        const msgContent = data.args[1];
                        const msgReplyTopic = data.args[2];
                        const msgPeerName = data.args[3];
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' (reply = '" + msgReplyTopic + "') from peer #" + msgPeerName)

                        ipcbus._subscriptions.ForEachTopic(msgTopic, function (peerNames, conn, topic) {
                            // Request data to subscribed connections
                            BaseIpc.Cmd.exec(IPC_BUS_EVENT_REQUESTMESSAGE, topic, msgContent, msgReplyTopic, msgPeerName, conn)
                        })
                        break
                    }
                case IPC_BUS_COMMAND_QUERYSTATE:
                    {
                        const msgTopic = data.args[0];
                        const msgPeerName = data.args[1];
                        console.log("[IPCBus:Broker] QueryState message reply on topic : " + msgTopic + " from peer #" + msgPeerName)

                        var queryStateResult = [];
                        ipcbus._subscriptions.ForEachConn(function (peerNames, conn, topic) {
                            peerNames.forEach(function (count, peerName) {
                                queryStateResult.push({ topic: topic, peerName: peerName, count: count })
                            })
                        })

                        BaseIpc.Cmd.exec(IPC_BUS_EVENT_SENDMESSAGE, msgTopic, queryStateResult, msgPeerName, conn)
                    }
            }
        }
    })

    baseIpc.on('close', function (err, conn, server) {

        _cleanUpConn(ipcbus, conn)

        console.log("[IPCBus:Broker] Connection closed !")
    })
}

function _clientConnectProc(ipcbus, baseIpc, busPath, conn, callback) {

    console.log("[IPCBus:Client] Connected to broker on '" + busPath + "'")

    const BaseIpc = require(BASE_IPC_MODULE)

    ipcbus._connection = conn

    if (callback !== undefined) {

        callback('connect', ipcbus._connection)
    }

    baseIpc.on('data', function (data, conn) {

        if (BaseIpc.Cmd.isCmd(data) == true) {

            switch (data.name) {

                case IPC_BUS_EVENT_SENDMESSAGE:
                    {
                        const msgTopic = data.args[0]
                        const msgContent = data.args[1]
                        const msgPeerName = data.args[2]
                        console.log("[IPCBus:Client] Emit message received on topic '" + msgTopic + "' from peer #" + msgPeerName)
                        EventEmitter.prototype.emit.call(ipcbus, msgTopic, msgTopic, msgContent, msgPeerName)
                        break
                    }

                case IPC_BUS_EVENT_REQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0]
                        const msgContent = data.args[1]
                        const msgReplyTopic = data.args[2]
                        const msgPeerName = data.args[3]
                        console.log("[IPCBus:Client] Emit request received on topic '" + msgTopic + "' from peer #" + msgPeerName)
                        EventEmitter.prototype.emit.call(ipcbus, msgTopic, msgTopic, msgContent, msgReplyTopic, msgPeerName)
                        break
                    }
            }
        }
    })
}

function _generateReplyTopic() {

    return 'replyTopic/' + uuid.v4()
}

function _getCmdLineArgValue(argName) {

    for (let i = 0; i < process.argv.length; i++) {

        if (process.argv[i].startsWith("--" + argName)) {
            const argValue = process.argv[i].split("=")[1];
            return argValue;
        }
    }
    return null;
}

// Implementation for Renderer process
function IpcBusRendererClient(ipcObj) {

    EventEmitter.call(this)

    if (ipcObj === undefined || ipcObj === null) {

        ipcObj = require('electron').ipcRenderer
    }

    const self = this
    let connected = null

    ipcObj.on(IPC_BUS_RENDERER_RECEIVE, function (eventOrTopic, topicOrContent, contentOrPeer, peerOrUndefined) {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (peerOrUndefined === undefined) {
            console.log("[IPCBus:Client] Received message on '" + eventOrTopic + "'")
            EventEmitter.prototype.emit.call(self, eventOrTopic, eventOrTopic, topicOrContent, contentOrPeer)
        }
        else {
            console.log("[IPCBus:Client] Received message on '" + topicOrContent + "'")
            EventEmitter.prototype.emit.call(self, topicOrContent, topicOrContent, contentOrPeer, peerOrUndefined)
        }
    })

    // Set API
    this.connect = function (callback) {
        if (connected == false) {
            throw new Error("Connection is closed")
        }
        // connect can be called multiple times
        connected = true
        setTimeout(function () {
            callback('connect')
        }, 1)
    }

    this.close = function () {
        connected = false
    }

    this.send = function (topic, data) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        ipcObj.send(IPC_BUS_RENDERER_SEND, topic, data)
    }

    this.request = function (topic, data, replyCallback, timeoutDelay) {
        if (connected != true) {
            throw new Error("Please connect first")
        }

        const replyTopic = _generateReplyTopic()
        EventEmitter.prototype.once.call(this, replyTopic, function (replyTopic, data, peer) {

            replyCallback(topic, data, peer)
        })

        if (timeoutDelay === undefined) {
            timeoutDelay = 2000
        }
        ipcObj.send(IPC_BUS_RENDERER_REQUEST, topic, data, replyTopic, timeoutDelay)
    }

    this.queryBrokerState = function (topic) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        ipcObj.send(IPC_BUS_RENDERER_QUERYSTATE, topic)
    }

    this.subscribe = function (topic, handler) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        EventEmitter.prototype.addListener.call(this, topic, handler)
        ipcObj.send(IPC_BUS_RENDERER_SUBSCRIBE, topic)
    }

    this.unsubscribe = function (topic, handler) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        EventEmitter.prototype.removeListener.call(this, topic, handler)
        ipcObj.send(IPC_BUS_RENDERER_UNSUBSCRIBE, topic)
    }
}

util.inherits(IpcBusRendererClient, EventEmitter)

// Implementation for Node process
function IpcBusNodeClient(busPath) {
    EventEmitter.call(this)

    // Setup
    const self = this
    if (busPath === undefined || busPath === null) {

        busPath = _getCmdLineArgValue('bus-path')
    }

    const BaseIpc = require(BASE_IPC_MODULE)
    const baseIpc = new BaseIpc()
    let busConn = null

    let clientPeerName = "Node_" + process.pid

    if (process.type !== undefined && process.type === "browser") {
        const ipcMain = require("electron").ipcMain
        const {webContents} = require("electron")

        clientPeerName = "Master"

        let topicRendererRefs = new MapRefCount

        let rendererSubscribeHandler = function (msgTopic, msgContent, msgPeer) {
            console.log("[IPCBus:Bridge] message received on '" + msgTopic + "'")
            topicRendererRefs.ForEachTopic(msgTopic, function (peerNames, valueId, topic) {
                const peerName = "Renderer_" + valueId
                console.log("[IPCBus:Bridge] Forward message received on '" + topic + "' to peer #" + peerNames[0])
                var currentWCs = webContents.fromId(valueId)
                if (currentWCs != undefined) {
                    currentWCs.send(IPC_BUS_RENDERER_RECEIVE, topic, msgContent, msgPeer)
                }
            })
        }

        var rendererCleanUp = function _rendererCleanUp(wcsId) {
            topicRendererRefs.ReleaseConn(wcsId, function (topic, conn, peerName, count) {
                if (count == 0) {
                    console.log("[IPCBus:Bridge] Forward unsubscribe '" + topic + "' to IPC Broker")
                    EventEmitter.prototype.removeListener.call(self, topic, rendererSubscribeHandler)
                }
                BaseIpc.Cmd.exec(IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, busConn)
            })
        }

        ipcMain.addListener(IPC_BUS_RENDERER_SUBSCRIBE, function (event, topic) {
            const currentWCs = event.sender
            const peerName = "Renderer_" + currentWCs.id
            console.log("[IPCBus:Bridge] Peer #" + peerName + " subscribed to topic '" + topic + "'")
            topicRendererRefs.AddRef(topic, currentWCs.id, peerName, function (keyTopic, valueId, peerName, count) {
                if (count == 1) {
                    EventEmitter.prototype.addListener.call(self, topic, rendererSubscribeHandler)
                    console.log("[IPCBus:Bridge] Forward subscribe '" + topic + "' to IPC Broker")
                    currentWCs.on("destroyed", function () {
                        rendererCleanUp(valueId)
                    })
                }
                BaseIpc.Cmd.exec(IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, peerName, busConn)
            })
        })

        ipcMain.addListener(IPC_BUS_RENDERER_UNSUBSCRIBE, function (event, topic) {
            const currentWCs = event.sender
            const peerName = "Renderer_" + currentWCs.id
            console.log("[IPCBus:Bridge] Peer #" + peerName + " unsubscribed from topic : '" + topic + "'")
            topicRendererRefs.Release(topic, currentWCs.id, peerName, function (keyTopic, valueId, peerName, count) {
                if (count == 0) {
                    console.log("[IPCBus:Bridge] Forward unsubscribe '" + topic + "' to IPC Broker")
                    EventEmitter.prototype.removeListener.call(self, topic, rendererSubscribeHandler)
                }
                BaseIpc.Cmd.exec(IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, busConn)
            })
        })

        ipcMain.addListener(IPC_BUS_RENDERER_SEND, function (event, topic, data) {
            const currentWCs = event.sender
            const peerName = "Renderer_" + currentWCs.id
            console.log("[IPCBus:Bridge] Peer #" + peerName + " sent message on '" + topic + "'")
            self.sendWithPeerName(peerName, topic, data)
        })

        ipcMain.addListener(IPC_BUS_RENDERER_REQUEST, function (event, topic, data, replyTopic, timeoutDelay) {
            const currentWCs = event.sender
            const peerName = "Renderer_" + currentWCs.id
            console.log("[IPCBus:Bridge] Peer #" + peerName + " sent request on '" + topic + "'")
            self.requestWithPeerName(peerName, topic, data, function (replyContent, replyPeer) {

                console.log("[IPCBus:Bridge] Sending request result to peer #" + peerName)
                currentWCs.send(IPC_BUS_RENDERER_RECEIVE, replyTopic, replyContent, replyPeer)

            }, timeoutDelay);
        })

        ipcMain.addListener(IPC_BUS_RENDERER_QUERYSTATE, function (event, topic, data) {
            const currentWCs = event.sender
            const peerName = "Renderer_" + currentWCs.id
            console.log("[IPCBus:Bridge] Peer #" + peerName + " query Broker state on topic : '" + topic + "'")
            self.queryBrokerState(topic)
        })

        console.log("[IPCBus:Bridge] Installed")
    }

    // Set API
    this.connect = function (callback) {
        baseIpc.on('connect', function (conn) {

            busConn = conn

            _clientConnectProc(self, baseIpc, busPath, busConn, callback)
        })
        baseIpc.connect(busPath)
    }

    this.close = function () {

        busConn.end()
    }

    this.sendWithPeerName = function (peerName, topic, data) {

        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_SENDMESSAGE, topic, data, peerName, busConn)
    }

    this.send = function (topic, data) {

        this.sendWithPeerName(clientPeerName, topic, data)
    }

    this.requestWithPeerName = function (peerName, topic, data, replyCallback, timeoutDelay) {

        if (timeoutDelay === undefined) {

            timeoutDelay = 2000; // 2s by default
        }

        // Set reply's topic 
        const replyTopic = _generateReplyTopic()

        // Prepare reply's handler
        const replyHandler = function (replyTopic, content, peerName) {

            console.log('Peer #' + peerName + ' replied to request on ' + replyTopic + ' : ' + content)

            self.unsubscribe(replyTopic, replyHandler)

            replyCallback(topic, content, peerName)
        }

        self.subscribe(replyTopic, replyHandler);

        // Execute request
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_REQUESTMESSAGE, topic, data, replyTopic, peerName, busConn)
    }

    this.request = function (topic, data, replyCallback, timeoutDelay) {

        this.requestWithPeerName(clientPeerName, topic, data, replyCallback, timeoutDelay)
    }

    this.queryBrokerStateWithPeerName = function (peerName, topic) {
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_QUERYSTATE, topic, peerName, busConn)
    }

    this.queryBrokerState = function (topic) {
        self.queryBrokerStateWithPeerName(clientPeerName, topic)
    }

    this.subscribeWithPeerName = function (peerName, topic, handler) {

        EventEmitter.prototype.addListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, peerName, busConn)
    }

    this.subscribe = function (topic, handler) {

        this.subscribeWithPeerName(clientPeerName, topic, handler)
    }

    this.unsubscribeWithPeerName = function (peerName, topic, handler) {

        EventEmitter.prototype.removeListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, busConn)
    }

    this.unsubscribe = function (topic, handler) {

        this.unsubscribeWithPeerName(clientPeerName, topic, handler)
    }
}

util.inherits(IpcBusNodeClient, EventEmitter)

// Implementation for Broker process
function IpcBusBroker(busPath, brokerProc) {
    if (busPath === undefined || busPath === null) {

        busPath = _getCmdLineArgValue('bus-path')
    }
    if (brokerProc === undefined || brokerProc === null) {

        brokerProc = _brokerListeningProc
    }

    const BaseIpc = require(BASE_IPC_MODULE)
    const baseIpc = new BaseIpc()
    const self = this
    let ipcServer = null

    this._subscriptions = new MapRefCount()

    // Set API
    this.start = function () {

        baseIpc.on('listening', function (server) {
            ipcServer = server
            brokerProc(self, baseIpc, busPath, server)
        })
        baseIpc.listen(busPath)
    }

    this.stop = function () {

        ipcServer.close()
        ipcServer = null
    }
}

// Export instance depending current process type
module.exports = function () {
    const processType = arguments.length >= 1 ? arguments[0] : process.type
    const arg1 = arguments.length >= 2 ? arguments[1] : null
    const arg2 = arguments.length >= 3 ? arguments[2] : null
    switch (processType) {
        case 'renderer':
            return new IpcBusRendererClient(arg1) // arg1 = ipcRenderer

        case 'main':
            return new IpcBusNodeClient(arg1) // arg1 = busPath

        case 'broker':
            return new IpcBusBroker(arg1, arg2) // arg1 = busPath, arg2 = customBrokerProc

        case 'bus-uuid':
            return '/electron-ipc-bus/' + uuid.v4();

        default:
            return new IpcBusNodeClient(arg1) // arg1 = busPath
    }
}