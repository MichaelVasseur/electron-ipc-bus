// Load modules
const ipcBusModule = require("electron-ipc-bus");
const electronApp = require('electron').app;

// Configuration
const ipcBusPath = 50494;
// const ipcBusPath = '/myfavorite/path';

// Startup
electronApp.on('ready', function () {
    // Create broker
    const ipcBusBrokerNode = ipcBusModule.CreateIpcBusBroker(ipcBusPath);

    // Start broker
    ipcBusBrokerNode.start()

    // Create client
        .then((msg) => {
            const ipcBusClient1 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
            const ipcBusClient2 = ipcBusModule.CreateIpcBusClient(ipcBusPath);
            Promise.all([ipcBusClient1.connect('client1'), ipcBusClient2.connect('client2')])
            .then((msg) => {
    // Chatting on channel 'greeting'
                    ipcBusClient1.addListener('greeting', (ipcBusEvent, greetingMsg) => {
                        if (ipcBusEvent.request) {
                            ipcBusEvent.request.resolve('thanks to you, dear #' + ipcBusEvent.sender.name);
                        }
                        else {
                            ipcBusClient1.send('greeting-reply', 'thanks to all listeners')
                        }
                        console.log(ipcBusClient1.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingMsg);
                    });

                    ipcBusClient2.addListener('greeting', (ipcBusEvent, greetingMsg) => {
                        if (ipcBusEvent.request) {
                            ipcBusEvent.request.resolve('thanks to you, dear #' + ipcBusEvent.sender.name);
                        }
                        else {
                            ipcBusClient2.send('greeting-reply', 'thanks to all listeners')
                        }
                        console.log(ipcBusClient2.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingMsg);
                    });

                    ipcBusClient1.addListener('greeting-reply', (ipcBusEvent, greetingReplyMsg) => {
                        console.log(greetingReplyMsg);
                        console.log(ipcBusClient1.peer.name + ' received ' + ipcBusEvent.channel + ':' + greetingReplyMsg);
                    });

                    ipcBusClient2.send('greeting', 'hello everyone!');

                    ipcBusClient2.request('greeting', 'hello partner!')
                        .then((ipcBusRequestResponse) => {
                            console.log(JSON.stringify(ipcBusRequestResponse.event.sender) + ' replied ' + ipcBusRequestResponse.payload);
                        })
                        .catch((err) => {
                            console.log('I have no friend :-(');
                        });

                    ipcBusClient1.request(1000, 'greeting', 'hello partner, please answer within 1sec!')
                        .then((ipcBusRequestResponse) => {
                            console.log(JSON.stringify(ipcBusRequestResponse.event.sender) + ' replied ' + ipcBusRequestResponse.payload);
                        })
                        .catch((err) => {
                            console.log('I have no friend :-(');
                        });
                });
        });
});