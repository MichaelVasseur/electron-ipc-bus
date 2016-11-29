function getProcessType(elt)
{
      if (elt != null)
      {
          if (elt.classList.contains("renderer"))
          {
              return "renderer"
          }
          if (elt.classList.contains("master"))
          {
              return "master"
          }
          if (elt.classList.contains("node"))
          {
              return "node"
          }
      }
      return getProcessType(elt.parentElement);
}

function doSubscribeToTopic(event) {
    var target = event.target;
    var topicActionsElt = target.parentElement;

    var topicProcess = getProcessType(target);

    var topicNameElt = topicActionsElt.querySelector(".topicName");
    var topicName = topicNameElt.value;

    var topicItemElt = document.getElementById("topicNameItem_template");
    var topicItemElt = topicItemElt.cloneNode(true);
    topicItemElt.id = "";
    topicItemElt.classList.add("subscription-" + topicName);

    var topicNameElt = topicItemElt.querySelector(".topicName");
    topicNameElt.textContent = topicName;

    var SubscriptionsListElt = document.querySelector("fieldset." + topicProcess + " > div");
    SubscriptionsListElt.appendChild(topicItemElt);
    topicItemElt.style.display = "block";

    if (topicProcess == "renderer")
    {
        ipcBus.subscribe(topicName, onIPC_renderer);
    }
    if (topicProcess == "master")
    {
        ipcBus.send("ipc-tests/master-subscribe-topic", topicName);
//        ipcRenderer.send("ipc-tests/ipc-master-subscribe", topicName);
    }
    if (topicProcess == "node")
    {
        ipcBus.send("ipc-tests/node-subscribe-topic", topicName);
//        ipcRenderer.send("ipc-tests/ipc-master-subscribe", topicName);
    }
    console.log(topicProcess + " topicName : " + topicName + " - subscribe");
}

function doSendMessageToTopic(event){
    console.log("doSendMessageToTopic:" + event);

    var target = event.target;
    var topicItemElt = target.parentElement;

    var topicProcess = getProcessType(target);

    var topicNameElt = topicItemElt.querySelector(".topicName");
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector(".topicMsg");
    var topicMsg = topicMsgElt.value;

    if (topicProcess == "renderer")
    {
        ipcBus.send(topicName, topicMsg);
    }
    if (topicProcess == "master")
    {
        ipcBus.send("ipc-tests/master-send-topic", { "topic" : topicName, "msg" : topicMsg});
//        ipcRenderer.send("ipc-tests/ipc-master-send", { "topic" : topicName, "msg" : target.value} );
    }
    if (topicProcess == "node")
    {
        ipcBus.send("ipc-tests/node-send-topic", { "topic" : topicName, "msg" : topicMsg});
//        ipcRenderer.send("ipc-tests/ipc-master-send", { "topic" : topicName, "msg" : target.value} );
    }
    console.log("topicName : " + topicName + " - send:" + topicMsg);
}

function doUnsubscribeFromTopic(event){
    console.log("doUnsubscribeFromTopic:" + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicProcess = getProcessType(target);
    var topicNameElt = topicItemElt.querySelector(".topicName");
    var topicName = topicNameElt.value;

    var SubscriptionsListElt = document.querySelector("fieldset." + topicProcess + " > div");
    SubscriptionsListElt.removeChild(topicItemElt);

    if (processTarget == "renderer")
    {
        ipcBus.unsubscribe(topicName, onIPC_renderer);
    }
    if (processTarget == "master")
    {
        ipcBus.send("ipc-tests/master-unsubscribe-topic", topicName);
//        ipcRenderer.send("ipc-tests/ipc-master-unsubscribe", topicName);
    }
    if (processTarget == "node")
    {
        ipcBus.send("ipc-tests/node-unsubscribe-topic", topicName);
//        ipcRenderer.send("ipc-tests/ipc-master-unsubscribe", topicName);
    }
    console.log(processTarget + " topicName : " + topicName + " - unsubscribe");
}

function doClearTopic(event)
{
    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicReceivedElt = topicItemElt.querySelector(".topicReceived");
    topicReceivedElt.value = "";
}

function onIPC_received(topicProcess, topicName, msgContent)
{
    console.log(topicProcess + " msgTopic:" + topicName + " msgContent:" + msgContent)

    var SubscriptionsListElt = document.querySelector("fieldset." + topicProcess + " > div");
    var topicItemElt = SubscriptionsListElt.querySelector(".subscription-" + topicName);
    if (topicItemElt != null)
    {
        var topicReceivedElt = topicItemElt.querySelector(".topicReceived");
        topicReceivedElt.value += msgContent + "\n";
    }
}

function onIPC_renderer(msgTopic, msgContent) {
    onIPC_received("renderer", msgTopic, msgContent);
}

function onIPC_master(msgTopic, args) {
    onIPC_received("master", args["topic"], args["msg"]);
}

function onIPC_node(msgTopic, args) {
    onIPC_received("node", args["topic"], args["msg"]);
}

function doQueryBrokerState() {
    ipcBus.queryBrokerState();
}

function onIPC_BrokerStatusTopic(msgTopic, msgContent) {
    console.log("queryBrokerState - msgTopic:" + msgTopic + " msgContent:" + msgContent)

    var brokerStatesListElt = document.getElementById("brokerStatesList");
    // Keep the header
    while (brokerStatesListElt.rows.length > 1) {
        brokerStatesListElt.deleteRow(1);
    }   
    for(var i = 0; i < msgContent.length; ++i)
    {
        var row = brokerStatesListElt.insertRow(-1);
        var cell = row.insertCell(0);
        cell.innerHTML = msgContent[i]["topic"];

        var cell = row.insertCell(1);
        cell.innerHTML = msgContent[i]["connCount"];

        var cell = row.insertCell(2);
        cell.innerHTML = msgContent[i]["subCount"];
    }
}

//var ipcRenderer = require('electron').ipcRenderer;

ipcBus.subscribe('IPC_BUS_BROKER_STATUS_TOPIC', onIPC_BrokerStatusTopic);

ipcBus.subscribe("ipc-tests/master-received-topic", onIPC_master);
ipcBus.subscribe("ipc-tests/node-received-topic", onIPC_node);


