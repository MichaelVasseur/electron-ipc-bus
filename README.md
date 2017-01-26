# electron-ipc-bus
A safe Ipc bus for applications built on Electron. 

Dispatching of messages is managed by a broker. The broker can be instanciated in a node or in a the master process (not in renderer).
For performance purpose, it is better to instanciate the broker in an independent node process.

This Ipc bus works with Chromium/Electron in sandbox mode and with Chromium affinity case (several webpages hosted in the same renderer process)

## Ipc Bus Broker (IpcBusBroker interface)
### Initialization of the Broker (in a node process)

```js
const ipcBusModule = require("electron-ipc-bus");
const ipcBusBroker = ipcBusModule.CreateIpcBusBroker([busPath]);
```

The require() loads the module and CreateIpcBusBroker setups the broker with the ***busPath***.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code

```js
// Socket path
const ipcBusBroker = ipcBusModule.CreateIpcBusBroker('/my-ipc-bus-path');
```

```js
// Port number
const ipcBusBroker = ipcBusModule.CreateIpcBusBroker(58666);
```

Ex, busPath set by command line: electron . --bus-path=***value***
    
```js
const ipcBusBroker = ipcBusModule.CreateIpcBusBroker();
```

### Methods

#### start([timeoutDelay]) : Promise<string>
- timeoutDelay : number (milliseconds)

```js
ipcBusBroker.start() 
        .then((msg) => console.log(msg))
        .catch((err) => console.log(err))
````

Start the messages dispatcher.
If succeeded the msg is 'started' (do not rely on it, subject to change). 
If failed (timeout or any other internal error), ***err*** contains the error message.

#### stop()

```js
ipcBusBroker.stop() 
```

#### queryState() - for debugging purpose only

```js
var queryState = ipcBusBroker.queryState() 
````

Returns the list of pair <channel, peerName> subscriptions. Format may change from one version to another.
This information can be retrieved from an IpcBusClient through the channel : /electron-ipc-bus/queryState


## Ipc Bus client (IpcBusClient interface)

### Initialization in the Main/Browser Node process

```js
const ipcBusModule = require("electron-ipc-bus");
const ipcBus = ipcBusModule.CreateIpcBus([busPath]);
````

The require() loads the module. CreateIpcBus setups the client with the ***busPath*** that was used to start the broker.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:
```js
const ipcBus = ipcBusModule.CreateIpcBus('/my-ipc-bus-path');
```

Ex, busPath set by command line: electron . --bus-path=***value***
```js    
const ipcBus = ipcBusModule.CreateIpcBus();
```

### Initialization in a Node single process
 
Ex, busPath set by code:
```js
const ipcBus = ipcBusModule.CreateIpcBus('/my-ipc-bus-path');
```
Ex, busPath set by command line: electron . --bus-path=***value***
```js 
const ipcBus = ipcBusModule.CreateIpcBus();
```
### Initialization in a Renderer (Sandboxed or not) process
```js
const ipcBusModule = require("electron-ipc-bus");
const ipcBus = ipcBusModule.CreateIpcBus();
```

NOTE : If the renderer is running in sandboxed mode, the code above
must be run from the ***BrowserWindow***'s preload script (browserify -o BundledBrowserWindowPreload.js ***-x electron*** BrowserWindowPreload.js). 
Otherwise, the Electron's ipcRenderer is not accessible and the client cannot work.
The code below to make the client accessible to the the Web page scripts.

```js
window.ipcBus = require('electron-ipc-bus').CreateIpcBus();
```

## How to use
The IpcBusClient is an instance of the EventEmitter class.

When you register a callback to a specified channel. Each time a message is received on this channel, the callback is called.
The callback must follow the IpcBusListener signature.

### Listening Methods
The IpcBusClient has the following methods:

#### connect([timeoutDelay]) : Promise<string>
- timeoutDelay : number (milliseconds)

```js
ipcBus.connect().then((eventName) => console.log("Connected to Ipc bus !"))
```

#### close()
```js
ipcBus.close()
```

#### addListener(channel, listener)
- channel: string
- listener: IpcBusListener

Listens to channel, when a new message arrives listener would be called with listener(event, args...).
NOTE: on, prependListener, once and prependOnceListener methods are supported as well

#### removeListener(channel, listener)
- channel: string
- listener: IpcBusListener

Removes the specified listener from the listener array for the specified channel.
NOTE: off is supported as well

#### removeAllListeners([channel])
channel: String (optional)

Removes all listeners, or those of the specified channel.

### Posting Methods
#### send(channel [, ...args])
- channel : string
- ...args any[]

Send a message asynchronously via ***channel***, you can also send arbitrary arguments. 
Arguments will be serialized in JSON internally and hence no functions or prototype chain will be included.

```js
ipcBus.send("Hello!", { name: "My age !"}, "is", 10)
```

#### request(timeoutDelay, channel [, ...args]) : Promise<IpcBusRequestResponse>
- timeoutDelay : number (milliseconds)
- channel : string
- ...args any[]

Send a request message on specified channel. the returned promise is settled when a result is available.

```js
ipcBus.request(2000, "compute", "2*PI*9")
    .then(ipcBusRequestResponse) {
        console.log("channel = " + ipcBusRequestResponse.event.channel + ", response = " + ipcBusRequestResponse.payload + ", from = " + ipcBusRequestResponse.event.sender.peerName);
     }
     .catch(ipcBusRequestResponse) {
        console.log("err = " + ipcBusRequestResponse.payload);
     }
```

### IpcBusListener(event, ...args) callback
- event: IpcBusEvent
- ...args: any[]): void;

The first parameter of the callback is always an event which contains the channel and the origin of the message (sender).

```js
function HelloHandler(ipcBusEvent, content) {
    console.log("Received '" + content + "' on channel '" + ipcBusEvent.channel +"' from #" + ipcBusEvent.sender.peerName)
}
ipcBus.on("Hello!", HelloHandler)
```

### IpcBusEvent object
```ts
IpcBusEvent {
    channel: string;
    sender: IpcBusSender {
        peerName: string;
    };
    request?: IpcBusRequest {
        resolve(payload: Object | string): void;
        reject(err: string): void;
    };
}
```
The event object passed to the listener has the following properties:

#### event.channel: string

channel delivering the message

#### event.sender.peerName: string

For debugging purpose, each sender is identified by a peerName. 
The peerName is computed automatically from the type of the process : 
- Master
- Renderer + WebContents Id
- Node + Process Id

#### event.request [optional] : IpcBusRequest
if present the message is a request.
Listener can resolve the request by calling event.request.resolve with proper response 
or can reject the request by calling event.request.reject with an error message.

## Test application

The test-app folder contains all sources of the testing application.
NOTE : This folder is not packaged by NPM.

To build the application :

    cd examples
    cd test-app
    npm install
    npm run build

To run the application :

    npm run start

To run the application in sandboxed mode :

    npm run start-sandboxed

 
