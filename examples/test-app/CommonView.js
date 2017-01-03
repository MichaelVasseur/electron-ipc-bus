function doNewNodeInstance(event) {
    processToMonitor.send("new-process", "node");
}

function doNewRendererInstance(event) {
    processToMonitor.send("new-process", "renderer");
}

function getProcessElt() {
    return document.getElementById("ProcessMonitor");
}

function getTopicName(elt) {
    if (elt == null) {
        return "";
    }
    var topicName = elt.getAttribute("topic-name");
    if ((topicName !== undefined) && (topicName !== null)) {
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
        processToMonitor.postSubscribe(topicName);
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
        processToMonitor.postUnsubscribe(topicName);
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
        processToMonitor.postRequestMessage(topicName, topicMsg);
    }
}

function doRequestPromiseMessageToTopic(event) {
    console.log("doRequestMessageToTopic:" + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicNameElt = topicItemElt.querySelector(".topicRequestPromiseName");
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector(".topicRequestPromiseMsg");
    var topicMsg = topicMsgElt.value;

    var args = { topic: topicName, msg: topicMsg };
    if (processToMonitor.Type() == "renderer") {
        let p = ipcBus.requestPromise(topicName, topicMsg, 1000)
            .then((requestPromiseArgs) => {
                onIPCBus_OnRequestPromiseThen(requestPromiseArgs);
            })
            .catch((err) => {
                onIPCBus_OnRequestPromiseCatch(err);
            });
    }
    else {
        processToMonitor.postRequestPromiseMessage(topicName, topicMsg);
    }
}

function onIPCBus_OnRequestPromiseThen(requestPromiseArgs) {
    console.log("onIPCBus_OnRequestPromiseThen : requestPromiseArgs:" + requestPromiseArgs)
    var topicRespElt = document.querySelector(".topicRequestPromiseResponse");
    if (topicRespElt != null) {
        topicRespElt.value = requestPromiseArgs.payload + " from (" + requestPromiseArgs.peerName + ")";
    }
}

function onIPCBus_OnRequestPromiseCatch(err) {
    console.log("onIPCBus_OnRequestPromiseCatch : err:" + err)
    var topicRespElt = document.querySelector(".topicRequestPromiseResponse");
    if (topicRespElt != null) {
        topicRespElt.value = "Error:" + err;
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
        processToMonitor.postSendMessage(topicName, topicMsg);
    }
}

function doClearTopic(event) {
    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicReceivedElt = topicItemElt.querySelector(".topicReceived");
    topicReceivedElt.value = "";
}

function onIPC_Received(topicName, msgContent, msgPeer, topicToReply) {
    console.log("onIPCBus_received : msgTopic:" + topicName + " msgContent:" + msgContent)

    var SubscriptionsListElt = document.getElementById("ProcessSubscriptions");
    var topicItemElt = SubscriptionsListElt.querySelector(".subscription-" + topicName);
    if (topicItemElt != null) {
        var topicAutoReplyElt = topicItemElt.querySelector(".topicAutoReply");
        if (topicToReply != undefined) {
            msgContent += " from (" + msgPeer + ")";
            ipcBus.send(topicToReply, topicAutoReplyElt.value);
        }
        var topicReceivedElt = topicItemElt.querySelector(".topicReceived");
        topicReceivedElt.value += msgContent + "\n";
    }
}

function onIPCBus_ReceivedRequest(topicName, msgContent, peerName) {
    console.log("onIPCBus_ReceivedRequest : msgTopic:" + topicName + " msgContent:" + msgContent)

    var topicRespElt = document.querySelector(".topicRequestResponse");
    if (topicRespElt != null) {
        topicRespElt.value += msgContent + " from (" + peerName + ")";
    }
}

function onIPCBus_RequestResult(msgTopic, msgContent, msgResponse, peerName) {
    onIPCBus_ReceivedRequest(msgTopic, msgResponse, peerName);
}

function onIPCBus_ReceivedSend(msgTopic, msgContent, msgPeer, topicToReply) {
    onIPC_Received(msgTopic, msgContent, msgPeer, topicToReply);
}

function onIPCBus_ReceivedSendNotify(msgTopic, msgContent, msgPeer, topicToReply) {
    onIPC_Received(msgTopic, msgContent, msgPeer, topicToReply);
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
    // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
    const args = (data !== undefined) ? data : event;
    console.log("initializeWindow" + args);

    var processMonitorElt = document.getElementById("ProcessMonitor");
    processMonitorElt.setAttribute("topic-process", args["type"]);

    var processTitleElt = document.getElementById("ProcessTitle");
    processTitleElt.textContent = args["peerName"];
    document.title = processTitleElt.textContent;

    var processMonitorDefaultSubscribe = processMonitorElt.querySelector(".topicSubscribeName");
    processMonitorDefaultSubscribe.value = "TopicOf" + args["peerName"];

    var processMonitorDefaultSend = processMonitorElt.querySelector(".topicSendMsg");
    processMonitorDefaultSend.value = "SendFrom:" + args["peerName"];

    var processMonitorDefaultRequest = processMonitorElt.querySelector(".topicRequestMsg");
    processMonitorDefaultRequest.value = "RequestFrom:" + args["peerName"];

    var processMonitorDefaultRequestPromise = processMonitorElt.querySelector(".topicRequestPromiseMsg");
    processMonitorDefaultRequestPromise.value = "PromiseFrom:" + args["peerName"];

    processToMonitor = new ProcessConnector(args["type"], ipcRenderer, args["id"]);
    if (args["type"] === "browser") {
        processToMonitor.onRequestPromiseThen(onIPCBus_OnRequestPromiseThen);
        processToMonitor.onRequestPromiseCatch(onIPCBus_OnRequestPromiseCatch);
        processToMonitor.OnRequestResult(onIPCBus_RequestResult);
        processToMonitor.OnReceivedMessage(onIPCBus_ReceivedSendNotify);
        processToMonitor.onSubscribeDone(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeDone(onIPCElectron_UnsubscribeNotify);

        var processToolbarElt = document.getElementById("ProcessToolbar");
        processToolbarElt.style.display = "block";

        var processBrokerStateElt = document.getElementById("ProcessBrokerState");
        processBrokerStateElt.style.display = "block";

        ipcBus.connect(function () {
            ipcBus.subscribe("brokerStateResults", onIPC_BrokerStatusTopic);
            doQueryBrokerState();
        });
    }
    if (args["type"] === "renderer") {
        ipcBus.connect(function () {
        });
    }
    if (args["type"] === "node") {
        processToMonitor.onRequestPromiseThen(onIPCBus_OnRequestPromiseThen);
        processToMonitor.onRequestPromiseCatch(onIPCBus_OnRequestPromiseCatch);
        processToMonitor.OnRequestResult(onIPCBus_RequestResult);
        processToMonitor.OnReceivedMessage(onIPCBus_ReceivedSendNotify);
        processToMonitor.onSubscribeDone(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeDone(onIPCElectron_UnsubscribeNotify);
        ipcBus.connect(function () {
        });
    }
});

