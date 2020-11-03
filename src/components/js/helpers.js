// Server on.connection() does not know the name of the new connection.
// So we fire this event right after connection is made to pass the name of the room to the server.
// The Server needs this name to alert Visitors.
function openMyRoom(yourID) {
  let payload = {
    event: 'openMyRoom',
    message: yourID,
    ack: (ack) => {
      console.log('ACK :>> ', ack);
      // this.alertColor = 'success';
      // this.alertMessage = ack;
      // this.alertIcon = 'mdi-email-open';
      // this.alert = true;
    },
  };
  this.$socket.emit(payload.event, payload.message, payload.ack);
}