function doNewNodeInstance(event)
{
    processToMonitor.send("new-process", "node");
}

function doNewRendererInstance(event)
{
    processToMonitor.send("new-process", "renderer");
}

function getProcessElt() {
    return document.getElementById("ProcessMonitor");
}

function getTopicName(elt) {
    if (elt == null)
    {
        return "";
    }
    var topicName = elt.getAttribute("topic-name");
    if ((topicName !== undefined) && (topicName !== null))
    {
        return topicName;
    }
    return getTopicName(elt.parentElement);
}


function doSubscribeToTopic(event) {
    console.log("doSubscribeToTopic:" + event);

    var target = event.target;
    var topicActionsElt = target.parentElement;
    var topicNameElt = topicActionsElt.querySelector(".topicSubscribeName");
    var topicName = topicNameElt.value;

    if (processToMonitor.Type() === "renderer") {
        ipcBus.connect(function () {
            ipcBus.subscribe(topicName, onIPCBus_ReceivedSend);
            onIPCElectron_SubscribeNotify(topicName);
        });
    }
    else {
        processToMonitor.sendSubscribe(topicName);
    }
}

function onIPCElectron_SubscribeNotify(topicName) {
    console.log("onIPCElectron_SubscribeNotify:" + topicName);

    var topicItemTemplate = document.getElementById("SubscriptionItem-template");
    var topicItemElt = topicItemTemplate.cloneNode(true);

    topicItemElt.id = "";
    topicItemElt.setAttribute("topic-name", topicName);
    topicItemElt.classList.add("subscription-" + topicName);

    var topicNameElt = topicItemElt.querySelector(".topicSubscribeName");
    topicNameElt.textContent = topicName;

    var SubscriptionsListElt = document.getElementById("ProcessSubscriptions");
    SubscriptionsListElt.appendChild(topicItemElt);

    var topicAutoReplyElt = topicItemElt.querySelector(".topicAutoReply");
    topicAutoReplyElt.value = topicName + " - AutoReply";
    

    //    subscriptionsListElt.appendChild(topicItemElt);
    topicItemElt.style.display = "block";

    console.log("topicName : " + topicName + " - subscribe");
}

function doUnsubscribeFromTopic(event) {
    console.log("doUnsubscribeFromTopic:" + event);

    var target = event.target;
    var topicName = getTopicName(target);

    if (processToMonitor.Type() === "renderer") {
        ipcBus.connect(function () {
            ipcBus.unsubscribe(topicName, onIPCBus_ReceivedSend);
            onIPCElectron_UnsubscribeNotify(topicName);
        });
    }
    else {
        processToMonitor.sendUnsubscribe(topicName);
    }
}

function onIPCElectron_UnsubscribeNotify(topicName) {
    console.log("doUnsubscribeFromTopic:" + topicName);

    var SubscriptionsListElt = document.getElementById("ProcessSubscriptions");
    var topicItemElt = SubscriptionsListElt.querySelector(".subscription-" + topicName);

    SubscriptionsListElt.removeChild(topicItemElt);
    console.log("topicName : " + topicName + " - unsubscribe");
}

function doRequestMessageToTopic(event) {
    console.log("doRequestMessageToTopic:" + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicNameElt = topicItemElt.querySelector(".topicRequestName");
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector(".topicRequestMsg");
    var topicMsg = topicMsgElt.value;

    var args = { topic: topicName, msg: topicMsg };
    if (processToMonitor.Type() == "renderer") {
        ipcBus.request(topicName, topicMsg, onIPCBus_ReceivedRequest, 1000);
    }
    else {
        processToMonitor.requestMessage(topicName, topicMsg);
    }
}

function doSendMessageToTopic(event) {
    console.log("doSendMessageToTopic:" + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicNameElt = topicItemElt.querySelector(".topicSendName");
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector(".topicSendMsg");
    var topicMsg = topicMsgElt.value;

    var args = { topic: topicName, msg: topicMsg };
    if (processToMonitor.Type() == "renderer") {
        ipcBus.send(topicName, topicMsg);
    }
    else {
        processToMonitor.sendMessage(topicName, topicMsg);
    }
}

function doClearTopic(event) {
    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicReceivedElt = topicItemElt.querySelector(".topicReceived");
    topicReceivedElt.value = "";
}

function onIPC_Received(topicName, msgContent, topicToReply) {
    console.log("onIPCBus_received : msgTopic:" + topicName + " msgContent:" + msgContent)

    var SubscriptionsListElt = document.getElementById("ProcessSubscriptions");
    var topicItemElt = SubscriptionsListElt.querySelector(".subscription-" + topicName);
    if (topicItemElt != null) {
        var topicAutoReplyElt = topicItemElt.querySelector(".topicAutoReply");
        if (topicToReply != undefined)
        {
            msgContent += " from (" + topicToReply + ")";
            ipcBus.send(topicToReply, topicAutoReplyElt.value);
        }
        var topicReceivedElt = topicItemElt.querySelector(".topicReceived");
        topicReceivedElt.value += msgContent + "\n";
    }
}

function onIPCBus_ReceivedRequest(topicName, msgContent, peerName) {
    console.log("onIPCBus_ReceivedRequest : msgTopic:" + topicName + " msgContent:" + msgContent)

    var topicItemElt = document.querySelector(".topicRequestResponse");
    if (topicItemElt != null) {
        topicItemElt.value += msgContent + " from (" + peerName + ")";
    }
}

function onIPCBus_ReceivedRequestNotify(msgTopic, msgContent, msgResponse, peerName) {
    onIPCBus_ReceivedRequest(msgTopic, msgResponse, peerName);
}

function onIPCBus_ReceivedSend(msgTopic, msgContent, topicToReply) {
    onIPC_Received(msgTopic, msgContent, topicToReply);
}

function onIPCBus_ReceivedSendNotify(msgTopic, msgContent, topicToReply) {
    onIPC_Received(msgTopic, msgContent, topicToReply);
}

function doQueryBrokerState() {
    ipcBus.queryBrokerState("brokerStateResults");
}

function onIPC_BrokerStatusTopic(msgTopic, msgContent) {
    console.log("queryBrokerState - msgTopic:" + msgTopic + " msgContent:" + msgContent)

    var statesListElt = document.getElementById("brokerStatesList");
    statesListElt.style.display = "block";

    // Keep the header
    while (statesListElt.rows.length > 1) {
        statesListElt.deleteRow(1);
    }
    for (var i = 0; i < msgContent.length; ++i) {
        var row = statesListElt.insertRow(-1);
        var cell = row.insertCell(0);
        cell.innerHTML = msgContent[i]["topic"];

        var cell = row.insertCell(1);
        cell.innerHTML = msgContent[i]["peerName"];

        var cell = row.insertCell(2);
        cell.innerHTML = msgContent[i]["count"];
    }
}

var processToMonitor = null;
ipcRenderer.on("initializeWindow", function (event, data) {
    const args = (data !== undefined)? data: event;
    console.log("initializeWindow" + args);

    var processMonitorElt = document.getElementById("ProcessMonitor");
    processMonitorElt.setAttribute("topic-process", args["type"]);

    var processTitleElt = document.getElementById("ProcessTitle");

    if (args["type"] === "main") {
        processToMonitor = new ProcessConnector("main", ipcRenderer);
        processToMonitor.onReceivedSendNotify(onIPCBus_ReceivedSendNotify);
        processToMonitor.onReceivedRequestNotify(onIPCBus_ReceivedRequestNotify);
        processToMonitor.onSubscribeNotify(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeNotify(onIPCElectron_UnsubscribeNotify);

        var processToolbarElt = document.getElementById("ProcessToolbar");
        processToolbarElt.style.display = "block";

        var processBrokerStateElt = document.getElementById("ProcessBrokerState");
        processBrokerStateElt.style.display = "block";

        processTitleElt.textContent = args["peerName"];
        ipcBus.connect(function () {
            ipcBus.subscribe("brokerStateResults", onIPC_BrokerStatusTopic);
            doQueryBrokerState();
        });
    }
    if (args["type"] === "renderer") {
        processToMonitor = new ProcessConnector("renderer", args["id"], ipcRenderer);
        processTitleElt.textContent = args["peerName"];
        ipcBus.connect(function () {
        });
    }
    if (args["type"] === "node") {
        processToMonitor = new ProcessConnector("node", args["id"], ipcRenderer);
        processToMonitor.onReceivedRequestNotify(onIPCBus_ReceivedRequestNotify);
        processToMonitor.onReceivedSendNotify(onIPCBus_ReceivedSendNotify);
        processToMonitor.onSubscribeNotify(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeNotify(onIPCElectron_UnsubscribeNotify);
        processTitleElt.textContent = args["peerName"];
        ipcBus.connect(function () {
        });
    }
//    processTitleElt.textContent += " - WebContents ID = "+ args["webContentsId"];
    document.title = processTitleElt.textContent;

    var processMonitorDefaultSubscribe = processMonitorElt.querySelector(".topicSubscribeName");
    processMonitorDefaultSubscribe.value = "TopicOf" + args["peerName"];

    var processMonitorDefaultSend = processMonitorElt.querySelector(".topicSendMsg");
    processMonitorDefaultSend.value = "SendFrom:" + args["peerName"];

    var processMonitorDefaultRequest = processMonitorElt.querySelector(".topicRequestMsg");
    processMonitorDefaultRequest.value = "RequestFrom:" + args["peerName"];
});

