var app = require('../app');
var debug = require('debug')('apiCook:server');
var http = require('http');
var config = require('../config/config');
var initializeTemplates = require('../helpers/initializeTemplates')
var socketHelper = require('../helpers/socket')
var appReleaseHelper=require('../helpers/appRelease')
var initScript = require('../helpers/initScript');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.server;

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3333'); //In production PORT is 8081
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

//Call initial script
initScript.createDatabaseInitialCollections();

/**
 * Sockets.
 */
 
app.io = require('socket.io')(server);

require('socketio-auth')(app.io, {
  authenticate: socketHelper.authenticate,
  postAuthenticate: socketHelper.postAuthenticate,
  disconnect: socketHelper.disconnect,
  timeout: 1000
});


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

//Create or update templates in database
initializeTemplates.updateTemplates();

//Check application releases
appReleaseHelper.check();

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);

    logger.info('-------------- APP UP & RUNNING  ----------------');
    logger.info(addr, config);
    logger.info('-------------- ----------------  ----------------');

    ;
}