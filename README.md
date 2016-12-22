# electron-ipc-bus
A safe IPC bus for applications built on Electron. 
Dispatching of messages is managed by a broker.
For performance purpose, it is better to instanciate the broker in an independent process node instance.

## How to use
### Initialization of the Broker (in a node process)
    const ipcBusModule = require("electron-ipc-bus");
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker([busPath]);

The require() loads the module and CreateIpcBusBroker setups the broker with the ***busPath***.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:

    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker('/my-ipc-bus-path');

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker();

### Initialization in the Main/Browser Node process
 
    const ipcBusModule = require("electron-ipc-bus");
    const ipcBus = ipcBusModule.CreateIpcBusForProcess(ipcBusModule.ProcessType.Main, [, busPath]);

The require() loads the module. CreateIpcBusForProcess setups the client with the ***busPath*** that was used to start the broker.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:

    const ipcBus = ipcBusModule.CreateIpcBusForProcess(ipcBusModule.ProcessType.Main, '/my-ipc-bus-path');

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBus = ipcBusModule.CreateIpcBusForProcess(ipcBusModule.ProcessType.Main);

### Initialization in a Node single process
 
Ex, busPath set by code:

    const ipcBus = ipcBusModule.CreateIpcBusForProcess(ipcBusModule.ProcessType.Node, '/my-ipc-bus-path');

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBus = ipcBusModule.CreateIpcBusForProcess(ipcBusModule.ProcessType.Node);

### Initialization in a Renderer (Sandboxed or not) process

    const ipcBusModule = require("electron-ipc-bus");
    const ipcBus = ipcBusModule.CreateIpcBusForProcess(ipcBusModule.ProcessType.Renderer);

NOTE : If the renderer is running in sandboxed mode, the code above
must be run from the ***BrowserWindow***'s preload script. Otherwise, the
Electron's ipcRenderer is not accessible and the client cannot work.
The code below to make the client accessible to the the Web page scripts.

    window.ipcBus = ipcBus;

### Expiremental
A single function creates the right Ipc Bus whatever the process (Renderer, Main or Node)

    const ipcBusModule = require("electron-ipc-bus");
    const ipcBus = ipcBusModule.CreateIpcBus([busPath]);


### Common API - IPCBus Client
#### connect([handler])

Ex:
   
    ipcBus.connect(() => console.log("Connected to IPC bus !")) 

#### subscribe(topic, handler)
Subscribe to the specified topic. Each time a message is received on this topic,
handler is called with the data related to the message.
Ex:

    function HelloHandler(topic, content) {
       console.log("Received Hello! from '" + content.name + "'")
    }
    ipcBus.subscribe("Hello!", HelloHandler)

#### send(topic [, content])
Send a message to every client subscribed to this topic.
Ex:

    ipcBus.send("Hello!", { name: "My Name !"})

#### request(topic, content, callback [, timeoutDelay])
Send a request message on specified topic. ***callback*** is called when the result is available.
Ex:

    function processRequestResult(topic, result) {

        ...
    }        

    ipcBus.request("compute", "2*PI*9", processRequestResult )

#### unsubscribe(topic, handler)
Unsubscribe from the specified topic. handler won't be called anymore when
a message will be received on topic.
Ex:

    ipcBus.unsubscribe("Hello!", HelloHandler)

#### close()

Ex:

    ipcBus.close()

## Test application

The test-app folder contains all sources of the testing application.
NOTE : This folder is not packaged by NPM.

To build the application :

    npm install
    npm run build

To run the application :

    npm run start

To run the application in sandboxed mode :

    npm run start-sandboxed


 
 

 

 
