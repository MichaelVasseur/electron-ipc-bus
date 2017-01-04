
export interface IpcBusConnectHandler {
    (eventName: string, conn: any): void;
}

export interface IpcBusTopicHandler {
    (topic: string, payload: Object | string, peerName: string, replyTopic?: string): void;
}

export interface IpcBusRequestResponse {
    topic: string;
    payload: Object | string;
    peerName: string;
}

export interface IpcBusClient {
    connect(connectCallback: IpcBusConnectHandler): void;
    close(): void;
    subscribe(topic: string, listenCallback: IpcBusTopicHandler): void;
    unsubscribe(topic: string, listenCallback: IpcBusTopicHandler): void;
    send(topic: string, payload: Object | string): void;
    request(topic: string, data: Object | string, timeoutDelay: number): Promise<IpcBusRequestResponse>;
    queryBrokerState(topic: string): void;
}

export interface IpcBusBroker {
    start(): void;
    stop(): void;
}

