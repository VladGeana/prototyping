/* Scenarios:
The app starts in one of two states: new or used. Actually, mu is more accurate than new.
On the Room vue, once a Room name is given, a socket opens with the Room query to stipulate the name, id, and selected (default) namespace.
Exactly the same thing happens on the Visitor vue, but it's Visitor socket with a Visitor query.
If the Visitor name is an email address, the socket has an Admin query that gives the socket unlimited access to server state and activity across namespaces

This file tests all Visitors events, listeners, and functions. 
The roomClientSocket.Test.js file handles Rooms.
The LCT State Machine handles both simultaneously.

These tests follow the actual flow of data in the namespace.
Nothing happens in the namespace until at least one Room is online.

Each test passes a connectionMap to the next test.
*/

const SHOW = 1;

const clc = require('cli-color');
const success = clc.green.bold;
// const error = clc.red.bold;
// const warn = clc.yellow;
const info = clc.cyan;
const notice = clc.bgGreen.yellow.bold;
const highlight = clc.magenta;
const bold = clc.bold;
const {
  getNow,
  groupMessagesByRoomAndDate,
  logResults,
  newId,
  printJson,
} = require('./helpers');

const {
  openVisitorConnection,
  exposureWarning,
  enterRoom,
  exposeEventPromise,
  leaveRoom,

  // exposeOpenRooms,
  // exposeAllSockets,
  // exposeAvailableRooms,
  // exposeOccupiedRooms,
  // exposePendingRooms,
  // exposeVisitorsRooms,
} = require('./visitorClientSocket');
const {
  // getExposures,
  getWarning,
  groupBy,
  messages,
  pickVisitor,
  visitors,
} = require('./visitorData');

const {
  openRoomConnection,
  openRoom,
  alertVisitor,
} = require('./roomClientSocket');
const { pickRoom, rooms } = require('./roomData');

SHOW &&
  console.log(highlight(getNow(), 'Starting visitorClientSocket.Test.js'));
let connectionMap = new Map();
connectionMap.set('rooms', new Map());
connectionMap.set('visitors', new Map());

async function testopenRoomConnection() {
  const getConnections = new Promise(function(resolve) {
    let room = pickRoom(rooms);
    room.id = room.id || newId;
    room.nsp = room.nsp || '/';

    // 1) Open Room

    // NOTE: this on connect handler does things that the callee's
    // on connect handler for clientSocket (which has the same socket id) does not
    let roomSocket = openRoomConnection(room, (ack) => logResults.add(ack));
    roomSocket.on('connect', () => {
      // open Room with every connection to ensure pendingWarnings get sent
      openRoom(roomSocket, room);
      connectionMap.get('rooms').set(roomSocket.query.room, roomSocket);
      resolve(roomSocket);
    });
  });
  return await getConnections;
}

function checkVisitor(v) {
  v.id = v.id || newId;
  v.nsp = v.nsp || '/';
  return v;
}

async function testopenVisitorConnection() {
  // make connection map from some or all cached Visitor data
  const getSocket = new Promise(function(resolve) {
    // first time in, socket is a Room socket
    // so pick any Visitor to start
    // second time that Visitor is excluded from the list of the next Visitor
    let nextVisitor = connectionMap.get('visitors').has('Nurse Diesel')
      ? 'AirGas Inc'
      : 'Nurse Diesel';
    let visitor = visitors.filter((v) => v.visitor == nextVisitor)[0];
    let socket = openVisitorConnection(checkVisitor(visitor));
    socket.on('connect', () => {
      const name = socket.query.visitor;
      logResults.add({ socket: socket.id, name: name });
      connectionMap.get('visitors').set(name, socket);
      resolve(socket);
    });
  });
  return await getSocket;
}

async function testLeaveRoom(message) {
  let visitorSocket = message.visitor;
  leaveRoom(visitorSocket, {
    visitor: message.visitor.query,
    room: message.room.query,
    sentTime: new Date().toISOString(),
    message: 'Leave',
  });
}

async function testExposureWarning(socket) {
  // logResults.start = 'Testing getVisitorSocket()';
  console.groupCollapsed(`[${getNow()}] testExposureWarning results:`);

  const sample = {
    // visitor warns  room
    // BENCHMARKING && console.time('by visitor.length');
    // const socket = getVisitorSocketByLength();
    // BENCHMARKING && console.timeEnd('by visitor.length');
    // WARNING MESSAGE STRUCT:
    //{
    //   sentTime: '2020-09-19T00:56:54.570Z',
    //   visitor: {
    //     visior: 'Nurse Jackie',
    //     id: 'FWzLl5dS9sr9FxDsAAAB',
    //     nsp: 'enduringNet',
    //   },
    //   warning: {              // ONE ROOM PER WARNING
    //     room: {
    //       room: 'Heathlands Medical',
    //       id: 'd6QoVa_JZxnM_0BoAAAA',
    //       nsp: 'enduringNet',
    //     },
    //     dates: [
    //       '2020-09-19T00:33:04.248Z',  // WARNING CAN
    //       '2020-09-14T02:53:33.738Z',  // HAVE MULTIPLE
    //       '2020-09-18T07:15:00.00Z',   // VISIT DATES
    //     ],
    //   },
    // };
  };

  console.log({
    step: 'Results from getVisitorSocket()',
    query: socket.query,
  });
  let payload = {
    array: messages.filter((v) => v.visitor.id == socket.id),
    prop: 'room',
    val: 'sentTime',
  };
  let warnings = groupMessagesByRoomAndDate(payload);

  const sample2 = {
    // Example warnings collection
    // [
    //   ['sentTime', '2020-10-27T19:05:53.082Z'],
    //   [
    //     'visitor',
    //     {
    //       visitor: 'AirGas Inc',
    //       id: 'JgvrILSxDwXRWJUpAAAC',
    //       nsp: 'enduringNet',
    //     },
    //   ],
    //   [
    //     'warnings',
    //     {
    //       d6QoVa_JZxnM_0BoAAAA: {
    //         room: 'Heathlands Medical',
    //         dates: ['2020-09-18', '2020-09-18', '2020-09-19'],
    //       },
    //       e1suC3Rdpj_1PuR3AAAB: {
    //         room: 'Heathlands Cafe',
    //         dates: ['2020-09-18', '2020-09-18', '2020-09-19'],
    //       },
    //     },
    //   ],
    // ];
  };

  let message = {
    sentTime: new Date().toISOString(),
    visitor: socket.query,
    warnings: warnings,
  };
  console.log({
    step: 'Value of message in testExposureWarning:',
    messages: Object.entries(message),
  });

  exposureWarning(socket, message, (ack) => {
    console.group(`[${getNow()}] Event (exposureWarning) ACK callback:`);
    console.log({
      ack: ack,
    });
    console.groupEnd();
  });
  // this returns before all events finish. is that ok?
  return socket;
}

// NOTE: this option is twice as slow
// function getVisitorSocketBySize() {
//   let visitors = connectionMap.get('visitors');
//   const idx = Math.floor(Math.random() * visitors.size);
//   let visitor = [...visitors][idx][1];
//   return visitor;
// }
function getVisitorSocketByLength() {
  let visitors = [...connectionMap.get('visitors').keys()];
  const idx = Math.floor(Math.random() * visitors.length);
  let visitor = connectionMap.get('visitors').get(visitors[idx]);
  return visitor;
}

async function testEnterRoom(visitorSocket) {
  // let visitorSocket = getVisitorSocketByLength();

  let rooms = [...connectionMap.get('rooms')]
    .map((v) => v[1])
    .filter((v) => v.query.room);
  let roomName = pickRoom(rooms).query.room;
  let roomSocket = connectionMap.get('rooms').get(roomName);

  const message = {
    visitor: visitorSocket.query,
    room: roomSocket.query,
    message: 'Entered',
    sentTime: new Date().toISOString(),
  };
  enterRoom(visitorSocket, message);

  // at this point, we don't need the connectionMap anymore.
  // from now on, we use the active Visitor and Room sockets.
  return { visitor: visitorSocket, room: roomSocket };
}

async function report(results) {
  SHOW &&
    console.log(
      success('=======================================================')
    );
  SHOW &&
    console.log(success(bold('Successful test of EnterRoom on', getNow())));
  SHOW &&
    console.log(
      success(
        '\t',
        results.visitor.query.visitor,
        'entered',
        results.room.query.room
      )
    );
  SHOW &&
    console.log(info('See detail below: Server Acknowledged: Enter Room:'));
  SHOW &&
    console.log(
      success('=======================================================')
    );
  // pass on the input to the next stage of processing the scenario...
  return results;
}

async function getStateOfTheServer(sockets) {
  const socket = sockets.visitor;
  let events = [
    { name: 'exposeOpenRooms', caption: 'All Rooms Promise:' },
    { name: 'exposeAllSockets', caption: 'All Sockets Promise:' },
    { name: 'exposeAvailableRooms', caption: 'Available Rooms Promise:' },
    { name: 'exposeOccupiedRooms', caption: 'Occupied Rooms Promise:' },
    { name: 'exposePendingWarnings', caption: 'Pending Rooms Promise:' },
    { name: 'exposeVisitorsRooms', caption: 'Visitors Rooms Promise:' },
  ];
  // this function needs only one declaration
  async function keepPromises(events) {
    events.forEach((event) => {
      exposeEventPromise(socket, event.name).then((rooms) => {
        console.groupCollapsed(event.caption);
        console.log(printJson(rooms));
        console.groupEnd();
      });
    });
  }
  keepPromises(events);

  // These calls merely log event results to the console:
  // exposeOpenRooms(socket);
  // exposeAllSockets(socket);
  // exposeAvailableRooms(socket);
  // exposeOccupiedRooms(socket);
  // exposePendingRooms(socket);
  // exposeVisitorsRooms(socket);

  return socket;
}

// --------------------------------------------------------------------------//
// Tests

let INCLUDE = 0;
INCLUDE &&
  testopenRoomConnection()
    .then((connectionMap) => testopenVisitorConnection(connectionMap))
    .then((connectionMap) => testEnterRoom(connectionMap))
    .then((results) => report(results))
    .then((results) => testLeaveRoom(results))
    .then(() => console.log(notice('success')));

// for this test, to ensure that warning is PENDING,
// don't open Room connection before opening a Visitor connection.
// then, emit exposureWarning
// finally, check PENDING Rooms
INCLUDE &&
  testopenVisitorConnection()
    .then(() => testExposureWarning())
    .then(() => testopenRoomConnection())
    // .then(() => testPendingRooms())
    .then(() => {
      logResults.show();
      console.log(' ');
    });
// this test now checks that pending rooms see warnings
// testopenRoomConnection();

//  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!//

//                BE SURE SERVER IS RUNNING BEFORE YOU TRY TO TEST!

//  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!//
testopenRoomConnection()
  .then((roomSocket) => testopenVisitorConnection(roomSocket)) // get first Visitor
  .then((socket) => testopenVisitorConnection(socket)) // get next Visitor
  .then((socket) => testExposureWarning(socket)) // Visitor warns Rooms
  .then((socket) => testEnterRoom(socket)) // Visitor enters a room to test pending
  .then((sockets) => getStateOfTheServer(sockets)) // display effect on State of the Server
  .then(() => {
    console.groupEnd();
    console.log(notice(`             Test Complete            `));
  })
  .then(() => console.log(notice(`        Event Results to Follow       `)));
