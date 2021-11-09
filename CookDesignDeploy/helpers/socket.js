var Auth = require('../models/auth');
var moment = require('moment');

exports.authenticate = (socket, data, callback) => {

		var authToken = data.token;
    console.log('Authenticating client socket request with authToken ', authToken)
    console.log('Socket id ', socket.conn.id)

		Auth.findOne({'token': authToken}, (err, auth) => {
        if (err) return callback(err)

        if(!auth) {
        		console.log('Invalid token')
            return callback(new Error('tokenNotFound'));
        }

        //Miramos que el token no haya caducado
        if (moment(auth.exp).isBefore(moment())) {
            return callback(new Error('tokenExpired'));
        }

        console.log('Client authenticated...')

        auth.update({socket: socket.conn.id}, (err, doc) => {
	        if (err || !doc) {
        			console.log('Invalid token')
	            return callback(new Error('updateTokenError'));
	        }
          console.log('Auth updated...')
					return callback(null, doc);
        })
        
    });
}

exports.postAuthenticate = (socket, data) => {

}

exports.disconnect = (socket) => {
  console.log(socket.id + ' disconnected');
}
