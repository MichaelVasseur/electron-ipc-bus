# electron-ipc-bus
A safe Ipc bus for applications built on Electron. 

Dispatching of messages is managed by a broker. The broker can be instanciated in a node or in a the master process (not in renderer).
For performance purpose, it is better to instanciate the broker in an independent node process.

This Ipc bus works in Chromium/Electron sandbox mode and in Chromium affinity case (several webpages hosted in the same renderer process)

# How to use
## Ipc Bus Broker
### Initialization of the Broker (in a node process)
    const ipcBusModule = require("electron-ipc-bus");
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker([busPath]);

The require() loads the module and CreateIpcBusBroker setups the broker with the ***busPath***.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:

    // Socket path
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker('/my-ipc-bus-path');

    // Port number
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker(58666);

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker();

### API
#### start()

Ex:
   
    ipcBusBroker.start() 
        .then((msg) => console.log(msg))
        .catch((err) => console.log(err))

Start the messages dispatcher

#### stop()

Ex:
   
    ipcBusBroker.stop() 


#### queryState() - for debugging purpose only

Ex:
   
    var queryState = ipcBusBroker.queryState() 

Returns the list of pair <channel, peerName> subscriptions. Format may change from one version to another.


## Ipc Bus client

### Initialization in the Main/Browser Node process
 
    const ipcBusModule = require("electron-ipc-bus");
    const ipcBus = ipcBusModule.CreateIpcBus([busPath]);

The require() loads the module. CreateIpcBus setups the client with the ***busPath*** that was used to start the broker.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:

    const ipcBus = ipcBusModule.CreateIpcBus('/my-ipc-bus-path');

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBus = ipcBusModule.CreateIpcBus();

### Initialization in a Node single process
 
Ex, busPath set by code:

    const ipcBus = ipcBusModule.CreateIpcBus('/my-ipc-bus-path');

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBus = ipcBusModule.CreateIpcBus();

### Initialization in a Renderer (Sandboxed or not) process

    const ipcBusModule = require("electron-ipc-bus");
    const ipcBus = ipcBusModule.CreateIpcBus();

NOTE : If the renderer is running in sandboxed mode, the code above
must be run from the ***BrowserWindow***'s preload script (browserify -o BundledBrowserWindowPreload.js ***-x electron*** BrowserWindowPreload.js). 
Otherwise, the Electron's ipcRenderer is not accessible and the client cannot work.
The code below to make the client accessible to the the Web page scripts.

    window.ipcBus = require('electron-ipc-bus').CreateIpcBus();

### Common API
Most the API inherits from the EventListener methods. 

When you register a callback to a specified channel. Each time a message is received on this channel, the callback is called.
The first parameter of the callback is always an event which contains the channel and the origin of the message (sender).

For debugging purpose, each sender is identified by a peerName. 
The peerName is computed automatically from the type of the process : 
- Master
- Renderer + WebContents Id
- Node + Process ID

Ex:
    // listener
    function HelloHandler(ipcBusEvent, content) {
       console.log("Received '" + content + "' on channel '" + ipcBusEvent.channel +"' from #" + ipcBusEvent.sender.peerName)
    }
    ipcBus.on("Hello!", HelloHandler)

    // sender
    ipcBus.send("Hello!", 'it's me')

#### connect([handler])

Ex:
   
    ipcBus.connect().then((eventName) => console.log("Connected to Ipc bus !"))

#### close()

Ex:

    ipcBus.close()


#### send(topic [, content])
Send a message to every client subscribed to this topic.
Ex:

    ipcBus.send("Hello!", { name: "My age !"}, "is", 10)

#### request(topic, content, [, timeoutDelay]) : Promise<IpcBusRequestResponse>
Send a request message on specified topic. promise is settled when a result is available.
Ex:

    ipcBus.request("compute", 2000, "2*PI*9")
        .then(ipcBusRequestResponse) {
            console.log("channel = " + ipcBusRequestResponse.event.channel + ", response = " + ipcBusRequestResponse.payload + ", from = " + ipcBusRequestResponse.event.sender.peerName);
        }
        .catch(ipcBusRequestResponse) {
            console.log("err = " + ipcBusRequestResponse.payload);
        }

To identify and manage such request, the clients must check the ***request*** parameter

    function ComputeHandler(ipcBusEvent, content) {
       console.log("Received '" + content + "' on channel '" + ipcBusEvent.channel +"' from #" + ipcBusEvent.sender.peerName)
       if (ipcBusEvent.request) {
           ipcBusEvent.request.resolve(eval(content))
       }
    }

    ipcBus.on("compute", ComputeHandler)


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

 
