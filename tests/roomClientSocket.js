const { groupBy, log, messages, printJson, report } = require('./helpersRoom');

const io = require('socket.io-client');
const base64id = require('base64id');

const moment = require('moment');
const clc = require('cli-color');
const success = clc.green.bold;
const error = clc.red.bold;
const warn = clc.yellow;
const info = clc.cyan;
// const notice = clc.blue;
const highlight = clc.magenta;
// const bold = clc.bold;

const { getNow } = require('./helpers');
const { rooms } = require('./roomData.js');

// methods called by state machine
const alertVisitor = (clientSocket, visitor, warnings) => {
  const message = {
    visitor: visitor,
    message: `${warnings}. To stop the spread, self-quarantine for 14 days.`,
    sentTime: new Date().toISOString(),
  };
  clientSocket.emit('alertVisitor', message, (rooms) => {
    console.log('Available Rooms:');
    console.table(rooms);
  });
};
const closeRoom = (clientSocket, message) => {
  clientSocket.emit('closeRoom', message, (rooms) => {
    console.log('Available Rooms:');
    console.table(rooms);
  });
};

const exposeAvailableRooms = (clientSocket) => {
  clientSocket.emit('exposeAvailableRooms', (rooms) => {
    console.log('Available Rooms:');
    console.table(rooms);
  });
};

const exposeOccupiedRooms = (clientSocket) => {
  clientSocket.emit('exposeOccupiedRooms', (rooms) => {
    console.log('Occupied Rooms:');
    console.table(rooms);
  });
};

const openRoom = (clientSocket, message) => {
  clientSocket.emit('openRoom', message, (ack) => {
    console.group('Inside EnterRoom: Server Acknowledged: Open Room:');
    console.log(success(ack));
    console.groupEnd();
  });
};
// end methods called by state machine

// listeners
// using named listeners makes it easier to remove listeners from socket event handlers
const onAvailableRoomsExposed = (message) => {
  console.groupCollapsed('onAvailableRoomsExposed results:');
  console.table(message);
  console.groupEnd();
};

const onCheckIn = (message) => {
  console.groupCollapsed('EnterRoom/CheckIn:');
  console.log(success('Results:', printJson(message)));
  console.groupEnd();
};

const onCheckOut = (message) => {
  console.groupCollapsed('LeaveRoom/CheckOut:');
  console.log(success('Results:', printJson(message)));
  console.groupEnd();
};

// onNotifyRoom:
// called by exposureWarning event handler on server
// server calls each affected Room to spread alert to other Visitors
// data param object:
//  data: {
//    visitor: visitor,
//    exposureDates: exposureDates, // based on warnings param input to exposureWarning
//    room: room,
//  },
const onNotifyRoom = (data, ack) => {
  // data can be on object or an array

  const { exposureDates, room, visitor } = data.length ? data[0] : data;

  let messageDates = groupBy({
    array: messages,
    prop: 'sentTime',
    val: 'visitor',
  });
  if (!Object.keys(messageDates).length) {
    alert(
      'UNEXEPECTED STATE: \nThere should be messages from the alerting Visitor.'
    );
    return;
  }
  console.log('messageDates:', report(messageDates));

  let alerts = new Map();
  // if only a single incoming date, make a Set with that
  // otherwise use the object for the Set
  let exposureDatesSet =
    typeof exposureDates == 'string'
      ? new Set().add(exposureDates)
      : new Set(exposureDates);

  console.log('Alert Dates', printJson(exposureDatesSet));
  console.log('Here are the necessary Exposure Alerts');
  exposureDatesSet.forEach((date) => {
    messageDates[moment(date).format('YYYY-MM-DD')].forEach((v) => {
      let phrase =
        v != visitor
          ? 'BE ADVISED: you may have been exposed to the virus'
          : 'CONFIRMING: you may have exposed others to the virus';
      let msg = `${v}, ${phrase} on date(s): ${moment(date).format('llll')}`;
      let alert = alerts.get(v);
      alerts.set(
        v,
        alert ? alert.concat(`, ${moment(date).format('llll')}`) : msg
      );
    });
  });

  // iterate the Map and emit alertVisitor event
  // Server will ensure a Visitor is online before forwarding event
  // otherwise, cache Visitor until they login again
  for (let [key, value] of alerts.entries()) {
    let message = {
      visitor: key,
      message: `${value}. To stop the spread, self-quarantine for 14 days.`,
      sentTime: new Date().toISOString(),
    };
    clientSocket.emit('alertVisitor', message, (ack) => {
      log.add(ack, 'alert');
    });
  }

  if (ack) ack(`${visitor}, ${room} alerted`);
};
// end listeners

// these are the sockets options in the Room.vue
// called by state machine
// room is an object {name, id, nsp}
function OpenRoomConnection(room) {
  const id = room.id || base64id.generateId();
  const nsp = room.nsp || '/';
  const query = { room: room.name, id: id, nsp: nsp };
  const clientSocket = io('http://localhost:3003', {
    query: query,
  });

  clientSocket.once('connect', () => {
    console.log(' ');
    console.log(highlight('Room Socket.io connection made:'));
    console.table(clientSocket.query);
    console.log(' ');
  });

  clientSocket.once('connect_error', (message) => {
    switch (message.type) {
      case 'TransportError':
        console.log(
          warn(
            `${clientSocket.query.room ||
              clientSocket.query.visitor} attempted to connect...`
          )
        );
        console.log(
          error(
            '...but LCT Socket.io Server may have gone down at or before',
            getNow()
          )
        );
        break;

      default:
        console.log(error('Unhandled connection error:'));
        console.log(error(message.message));
    }
  });

  clientSocket.on('checkIn', onCheckIn);

  clientSocket.on('checkOut', onCheckOut);

  // once event handler minimizes the number of times this socket handles an event
  clientSocket.once('availableRoomsExposed', onAvailableRoomsExposed);

  clientSocket.on('notifyRoom', onNotifyRoom);

  // namespace broadcast event handlers
  // e.g., on server:     io.of(namespace).emit('updatedOccupancy')
  // clientSocket.on('updatedOccupancy', (message) => {
  //   console.log(
  //     success(`${message.room} occupancy is now ${message.occupancy}`)
  //   );
  // });

  return clientSocket;
}

module.exports = {
  OpenRoomConnection,
  alertVisitor,
  closeRoom,
  exposeAvailableRooms,
  exposeOccupiedRooms,
  openRoom,
};

const TESTING = 1;

async function bvt() {
  // test helpers
  var getConnections = new Promise(function(resolve) {
    let connectionMap = new Map();
    let rs = rooms;
    let more = rooms.length;
    rs.forEach((room) => {
      let socket = OpenRoomConnection(room);
      socket.on('connect', () => {
        connectionMap.set(socket.query.room, socket);
        if (!--more) {
          resolve(connectionMap);
        }
      });
      exposeAvailableRooms(socket);
    });
  });

  return await getConnections;
}

TESTING &&
  bvt().then((c) => {
    console.log(info('connectionMap:'));
    console.table(c);
  });