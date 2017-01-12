var processId;
var peerName;

function doNewNodeProcess(event) {
    processToMaster.send('new-process', 'node');
}

function doNewRendererProcess(event) {
    processToMaster.send('new-process', 'renderer');
}

function doNewRendererInstance(event) {
    processToMaster.send('new-renderer', processId);
}

var transaction = 1;
function doPerformance(event) {
    var msgContent =
    {
        transaction : transaction,
        payload: 'very light'
    };
    ++transaction;
    ipcBus.send('test-performance-start', msgContent);
}

function onIPCBus_TestPerformanceStart(topicName, msgContent, peerName) {
    msgContent.origin = { 
        timeStamp: Date.now(),
        type: 'renderer', 
        peerName: ipcBus.peerName
    }
    ipcBus.send('test-performance-main', msgContent);
    ipcBus.send('test-performance-node', msgContent);
}

function onIPCBus_TestPerformance(topicName, msgContent, peerName) {
    msgContent.response = { 
        timeStamp: Date.now,
        type: 'renderer', 
        peerName: ipcBus.peerName
    }
    ipcBus.send('test-performance-result', msgContent);
}

var resultsMap = new Map;
function onIPCBus_TestPerformanceResult(topicName, msgContent, peerName) {
    // var results = resultsMap.get(msgContent.transaction);
    // if (result)
}


var rendererWindow;
function doNewAffinityRendererInstance(event) {
    var strWindowFeatures = 'menubar=yes,location=yes,resizable=yes,scrollbars=yes,status=no';
    rendererWindow = window.open('CommonView.html', 'Inner Page of ' + processId, strWindowFeatures);
    // rendererWindow.on('dom-ready', function () {
    //     rendererWindow.send('initializeWindow', { title: 'Renderer', type: 'renderer', id: processId, peerName: 'Renderer_' + rendererWindow.webContents.id, webContentsId: rendererWindow.webContents.id });
    // });
    // rendererWindow.postMessage('initializeWindow', { title: 'Renderer', type: 'renderer', id: processId, peerName: 'Renderer_' + rendererWindow.webContents.id, webContentsId: rendererWindow.webContents.id });
    // window.CreateInnerPage(processId);
}

function getProcessElt() {
    return document.getElementById('ProcessMonitor');
}

function getTopicName(elt) {
    if (elt == null) {
        return '';
    }
    var topicName = elt.getAttribute('topic-name');
    if ((topicName !== undefined) && (topicName !== null)) {
        return topicName;
    }
    return getTopicName(elt.parentElement);
}

function doSubscribeToTopic(event) {
    console.log('doSubscribeToTopic:' + event);

    var target = event.target;
    var topicActionsElt = target.parentElement;
    var topicNameElt = topicActionsElt.querySelector('.topicSubscribeName');
    var topicName = topicNameElt.value;

    if (processToMonitor.Type() === 'renderer') {
        ipcBus.connect()
            .then(() => {
                ipcBus.subscribe(topicName, onIPC_Received);
                onIPCElectron_SubscribeNotify(topicName);
        });
    }
    else {
        processToMonitor.postSubscribe(topicName);
    }
}

function onIPCElectron_SubscribeNotify(topicName) {
    console.log('onIPCElectron_SubscribeNotify:' + topicName);

    var topicItemTemplate = document.getElementById('SubscriptionItem-template');
    var topicItemElt = topicItemTemplate.cloneNode(true);

    topicItemElt.id = '';
    topicItemElt.setAttribute('topic-name', topicName);
    topicItemElt.classList.add('subscription-' + topicName);

    var topicNameElt = topicItemElt.querySelector('.topicSubscribeName');
    topicNameElt.textContent = topicName;

    var SubscriptionsListElt = document.getElementById('ProcessSubscriptions');
    SubscriptionsListElt.appendChild(topicItemElt);

    var topicAutoReplyElt = topicItemElt.querySelector('.topicAutoReply');
    topicAutoReplyElt.value = topicName + ' - AutoReply';

    //    subscriptionsListElt.appendChild(topicItemElt);
    topicItemElt.style.display = 'block';

    console.log('topicName : ' + topicName + ' - subscribe');
}

function doUnsubscribeFromTopic(event) {
    console.log('doUnsubscribeFromTopic:' + event);

    var target = event.target;
    var topicName = getTopicName(target);

    if (processToMonitor.Type() === 'renderer') {
        ipcBus.connect()
        .then(() => {
            ipcBus.unsubscribe(topicName, onIPC_Received);
            onIPCElectron_UnsubscribeNotify(topicName);
        });
    }
    else {
        processToMonitor.postUnsubscribe(topicName);
    }
}

function onIPCElectron_UnsubscribeNotify(topicName) {
    console.log('doUnsubscribeFromTopic:' + topicName);

    var SubscriptionsListElt = document.getElementById('ProcessSubscriptions');
    var topicItemElt = SubscriptionsListElt.querySelector('.subscription-' + topicName);

    SubscriptionsListElt.removeChild(topicItemElt);
    console.log('topicName : ' + topicName + ' - unsubscribe');
}

function doRequestMessageToTopic(event) {
    console.log('doRequestMessageToTopic:' + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicNameElt = topicItemElt.querySelector('.topicRequestName');
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector('.topicRequestMsg');
    var topicMsg = topicMsgElt.value;

    var topicRespElt = document.querySelector('.topicRequestResponse');
    topicRespElt.value = '';

    var args = { topic: topicName, msg: topicMsg };
    if (processToMonitor.Type() === 'renderer') {
        let p = ipcBus.request(topicName, topicMsg)
            .then((requestPromiseResponse) => {
                onIPCBus_OnRequestThen(requestPromiseResponse);
            })
            .catch((requestPromiseResponse) => {
                onIPCBus_OnRequestCatch(requestPromiseResponse);
            });
    }
    else {
        processToMonitor.postRequestMessage(topicName, topicMsg);
    }
}

function onIPCBus_OnRequestThen(requestPromiseResponse) {
    console.log('onIPCBus_OnRequestThen : requestPromiseArgs:' + requestPromiseResponse);
    var topicRespElt = document.querySelector('.topicRequestResponse');
    if (topicRespElt != null) {
        topicRespElt.style.color = 'black';
        topicRespElt.value = requestPromiseResponse.payload + ' from (' + requestPromiseResponse.peerName + ')';
    }
}

function onIPCBus_OnRequestCatch(requestPromiseResponse) {
    console.log('onIPCBus_OnRequestCatch : err:' + requestPromiseResponse.payload);
    var topicRespElt = document.querySelector('.topicRequestResponse');
    if (topicRespElt != null) {
        topicRespElt.style.color = 'red';
        topicRespElt.value = 'Error:' + requestPromiseResponse.payload;
    }
}

function doSendMessageToTopic(event) {
    console.log('doSendMessageToTopic:' + event);

    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicNameElt = topicItemElt.querySelector('.topicSendName');
    var topicName = topicNameElt.value;

    var topicMsgElt = topicItemElt.querySelector('.topicSendMsg');
    var topicMsg = topicMsgElt.value;

    var args = { topic: topicName, msg: topicMsg };
    if (processToMonitor.Type() === 'renderer') {
        ipcBus.send(topicName, topicMsg);
    }
    else {
        processToMonitor.postSendMessage(topicName, topicMsg);
    }
}

function doClearTopic(event) {
    var target = event.target;
    var topicItemElt = target.parentElement;
    var topicReceivedElt = topicItemElt.querySelector('.topicReceived');
    topicReceivedElt.value = '';
}

function onIPC_Received(topicName, msgContent, msgPeer, requestResolveCB, rejectResolveCB) {
    console.log('onIPCBus_received : msgTopic:' + topicName + ' msgContent:' + msgContent)

    var SubscriptionsListElt = document.getElementById('ProcessSubscriptions');
    var topicItemElt = SubscriptionsListElt.querySelector('.subscription-' + topicName);
    if (topicItemElt != null) {
        var topicAutoReplyElt = topicItemElt.querySelector('.topicAutoReply');
        if (requestResolveCB != undefined) {
            msgContent += ' from (' + msgPeer + ')';
//            ipcBus.send(topicToReply, topicAutoReplyElt.value);
            requestResolveCB(topicAutoReplyElt.value);
        }
        var topicReceivedElt = topicItemElt.querySelector('.topicReceived');
        topicReceivedElt.value += msgContent + '\n';
    }
}

function onIPCBus_ReceivedRequest(topicName, msgContent, peerName) {
    console.log('onIPCBus_ReceivedRequest : msgTopic:' + topicName + ' msgContent:' + msgContent)

    var topicRespElt = document.querySelector('.topicRequestResponse');
    if (topicRespElt != null) {
        topicRespElt.value += msgContent + ' from (' + peerName + ')';
    }
}

function onIPCBus_ReceivedSendNotify(msgTopic, msgContent, msgPeer) {
    onIPC_Received(msgTopic, msgContent, msgPeer);
}

function doQueryBrokerState() {
    ipcBus.queryBrokerState('brokerStateResults');
}

function onIPC_BrokerStatusTopic(msgTopic, msgContent) {
    console.log('queryBrokerState - msgTopic:' + msgTopic + ' msgContent:' + msgContent)

    var statesListElt = document.getElementById('brokerStatesList');
    statesListElt.style.display = 'block';

    // Keep the header
    while (statesListElt.rows.length > 1) {
        statesListElt.deleteRow(1);
    }
    for (var i = 0; i < msgContent.length; ++i) {
        var row = statesListElt.insertRow(-1);
        var cell = row.insertCell(0);
        cell.innerHTML = msgContent[i]['topic'];

        cell = row.insertCell(1);
        cell.innerHTML = msgContent[i]['peerName'];

        cell = row.insertCell(2);
        cell.innerHTML = msgContent[i]['count'];
    }
}

var processToMonitor = null;
ipcRenderer.on('initializeWindow', function (event, data) {
    // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
    const args = (data !== undefined) ? data : event;
    console.log('initializeWindow' + args);

    processId = args['id'];
    peerName  = args['peerName']; 

    var processMonitorElt = document.getElementById('ProcessMonitor');
    processMonitorElt.setAttribute('topic-process', args['type']);

    var processTitleElt = document.getElementById('ProcessTitle');
    processTitleElt.textContent = args['peerName'] + ' (' + processId + ')';
    document.title = processTitleElt.textContent;

    var processMonitorDefaultSubscribe = processMonitorElt.querySelector('.topicSubscribeName');
    processMonitorDefaultSubscribe.value = 'TopicOf' + args['peerName'];

    var processMonitorDefaultSend = processMonitorElt.querySelector('.topicSendMsg');
    processMonitorDefaultSend.value = 'SendFrom:' + args['peerName'];

    var processMonitorDefaultRequest = processMonitorElt.querySelector('.topicRequestMsg');
    processMonitorDefaultRequest.value = 'PromiseFrom:' + args['peerName'];

    processToMaster = new ProcessConnector('browser', ipcRenderer);

    processToMonitor = new ProcessConnector(args['type'], ipcRenderer, args['id']);
    if (args['type'] === 'browser') {
        processToMonitor.onRequestThen(onIPCBus_OnRequestThen);
        processToMonitor.onRequestCatch(onIPCBus_OnRequestCatch);
        processToMonitor.OnReceivedMessage(onIPCBus_ReceivedSendNotify);
        processToMonitor.onSubscribeDone(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeDone(onIPCElectron_UnsubscribeNotify);

        var processToolbar = document.getElementById('ProcessBrowserToolbar');
        processToolbar.style.display = 'block';

        processToolbar = document.getElementById('ProcessBrokerState');
        processToolbar.style.display = 'block';

        processToolbar = document.getElementById('ProcessPerformance');
        processToolbar.style.display = 'block';

        ipcBus.connect()
            .then(() => {
                console.log('renderer : connected to ipcBus');
                ipcBus.subscribe('brokerStateResults', onIPC_BrokerStatusTopic);
                ipcBus.subscribe('test-performance-start', onIPCBus_TestPerformanceStart);
                ipcBus.subscribe('test-performance-result', onIPCBus_TestPerformanceResult);
                doQueryBrokerState();
            });
    }
    if (args['type'] === 'renderer') {

        var processToolbar = document.getElementById('ProcessRendererToolbar');
        processToolbar.style.display = 'block';

        ipcBus.connect()
            .then(() => {
                console.log('renderer : connected to ipcBus');
                ipcBus.subscribe('test-performance-start', onIPCBus_TestPerformanceStart);
                ipcBus.subscribe('test-performance-renderer', onIPCBus_TestPerformance);
            });
    }
    if (args['type'] === 'node') {
        processToMonitor.onRequestThen(onIPCBus_OnRequestThen);
        processToMonitor.onRequestCatch(onIPCBus_OnRequestCatch);
        processToMonitor.OnReceivedMessage(onIPCBus_ReceivedSendNotify);
        processToMonitor.onSubscribeDone(onIPCElectron_SubscribeNotify);
        processToMonitor.onUnsubscribeDone(onIPCElectron_UnsubscribeNotify);
        ipcBus.connect()
            .then(() => {
                console.log('renderer : connected to ipcBus');
            });
    }
});

