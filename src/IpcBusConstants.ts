namespace ElectronIpcBus {
    // Constants
    export const IPC_BUS_TOPIC_SUBSCRIBE = 'IPC_BUS_TOPIC_SUBSCRIBE';
    export const IPC_BUS_TOPIC_SEND = 'IPC_BUS_TOPIC_SEND';
    export const IPC_BUS_TOPIC_UNSUBSCRIBE = 'IPC_BUS_TOPIC_UNSUBSCRIBE';

    export const IPC_BUS_RENDERER_SUBSCRIBE = 'IPC_BUS_RENDERER_SUBSCRIBE';
    export const IPC_BUS_RENDERER_SEND = 'IPC_BUS_RENDERER_SEND';
    export const IPC_BUS_RENDERER_REQUEST = 'IPC_BUS_RENDERER_REQUEST';
    export const IPC_BUS_RENDERER_UNSUBSCRIBE = 'IPC_BUS_RENDERER_UNSUBSCRIBE';
    export const IPC_BUS_RENDERER_RECEIVE = 'IPC_BUS_RENDERER_RECEIVE';
    export const IPC_BUS_RENDERER_QUERYSTATE = 'IPC_BUS_RENDERER_QUERYSTATE';

    export const IPC_BUS_COMMAND_SUBSCRIBETOPIC = 'subscribeTopic';
    export const IPC_BUS_COMMAND_UNSUBSCRIBETOPIC = 'unsubscribeTopic';
    export const IPC_BUS_COMMAND_SENDTOPICMESSAGE = 'sendTopicMessage';
    export const IPC_BUS_COMMAND_SENDREQUESTMESSAGE = 'sendRequestMessage';
    export const IPC_BUS_COMMAND_QUERYSTATE = 'queryState';
    export const IPC_BUS_EVENT_TOPICMESSAGE = 'onTopicMessage';
    export const IPC_BUS_EVENT_REQUESTMESSAGE = 'onRequestMessage';
}

