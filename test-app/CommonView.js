
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

function doSubscribeToTopic(event) {
    console.log("doSubscribeToTopic:" + event);

    var target = event.target;
    var topicActionsElt = target.parentElement;
    var topicNameElt = topicActionsElt.querySelector(".topicName");
    var topicName = topicNameElt.value;

    if (processToMonitor.Type() == "renderer") {
        ipcBus.connect(function () {
            ipcBus.subscribe(topicName, onIPCBus_ReceivedMessage);
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

    topicItemElt.classList.add("subscription-" + topicName);

    var topicNameElt = topicItemElt.querySelector(".topicName");
    topicNameElt.textContent = topicName;

    var topicFormElt = topicItemElt.querySelector(".form-inline");
    topicFormElt.setAttribute("topic-name", topicName);

    var SubscriptionsListElt = document.getElementById("ProcessSubscriptions");
    SubscriptionsListElt.appendChild(topicItemElt);

    //    subscriptionsListElt.appendChild(topicItemElt);
    topicItemElt.style.display = "block";

    console.log("topicName : " + topicName + " - subscribe");
}

function doUnsubscribeFromTopic(event) {
    console.log("doUnsubscribeFromTopic:" + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicName = topicItemElt.getAttribute("topic-name");

    if (processToMonitor.Type() == "renderer") {
        ipcBus.connect(function () {
            ipcBus.unsubscribe(topicName, onIPCBus_ReceivedMessage);
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

function doSendMessageToTopic(event) {
    console.log("doSendMessageToTopic:" + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicName = topicItemElt.getAttribute("topic-name");

    var topicMsgElt = topicItemElt.querySelector(".topicMsg");
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

function onIPC_Received(topicName, msgContent) {
    console.log("onIPCBus_received : msgTopic:" + topicName + " msgContent:" + msgContent)

    var SubscriptionsListElt = document.getElementById("ProcessSubscriptions");
    var topicItemElt = SubscriptionsListElt.querySelector(".subscription-" + topicName);
    if (topicItemElt != null) {
        var topicReceivedElt = topicItemElt.querySelector(".topicReceived");
        topicReceivedElt.value += msgContent + "\n";
    }
}

function onIPCBus_ReceivedMessage(msgTopic, msgContent) {
    onIPC_Received(msgTopic, msgContent);
}

function onIPCElectron_ReceivedMessageNotify(msgTopic, msgContent) {
    onIPC_Received(msgTopic, msgContent);
}

function doQueryBrokerState() {
    ipcBus.queryBrokerState("brokerStateResults");
}

function onIPC_BrokerStatusTopic(msgTopic, msgContent) {
    console.log("queryBrokerState - msgTopic:" + msgTopic + " msgContent:" + msgContent)

    var brokerStatesListElt = document.getElementById("brokerStatesList");
    brokerStatesListElt.style.display = "block";
    // Keep the header
    while (brokerStatesListElt.rows.length > 1) {
        brokerStatesListElt.deleteRow(1);
    }
    for (var i = 0; i < msgContent.length; ++i) {
        var row = brokerStatesListElt.insertRow(-1);
        var cell = row.insertCell(0);
        cell.innerHTML = msgContent[i]["topic"];

        var cell = row.insertCell(1);
        cell.innerHTML = msgContent[i]["connCount"];

        var cell = row.insertCell(2);
        cell.innerHTML = msgContent[i]["subCount"];
    }
}

ipcBus.connect(function () {
    ipcBus.subscribe("brokerStateResults", onIPC_BrokerStatusTopic);
    doQueryBrokerState();
});

var processToMonitor = null;
ipcRenderer.on("initializeWindow", function (event, data) {
    const args = (data !== undefined)? data: event;
    console.log("initializeWindow" + args);

    var processMonitorElt = document.getElementById("ProcessMonitor");
    processMonitorElt.setAttribute("topic-process", args["type"]);

    var processTitleElt = document.getElementById("ProcessTitle");

    if (args["type"] == "main") {
        processToMonitor = new ProcessConnector("main", ipcRenderer);
        processToMonitor.onReceivedMessageNotify(onIPCElectron_ReceivedMessageNotify);
        processToMonitor.onSubscribeNotify(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeNotify(onIPCElectron_UnsubscribeNotify);
        processTitleElt.textContent = args["title"];

        var processToolbarElt = document.getElementById("ProcessToolbar");
        processToolbarElt.style.display = "block";

        var processBrokerStateElt = document.getElementById("ProcessBrokerState");
        processBrokerStateElt.style.display = "block";
    }
    if (args["type"] == "renderer") {
        processToMonitor = new ProcessConnector("renderer", args["id"], ipcRenderer);
        processTitleElt.textContent = args["title"] + " - " + args["id"];
    }
    if (args["type"] == "node") {
        processToMonitor = new ProcessConnector("node", args["id"], ipcRenderer);
        processToMonitor.onReceivedMessageNotify(onIPCElectron_ReceivedMessageNotify);
        processToMonitor.onSubscribeNotify(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeNotify(onIPCElectron_UnsubscribeNotify);
        processTitleElt.textContent = args["title"] + " - " + args["id"];
    }
    document.title = processTitleElt.textContent;
});

