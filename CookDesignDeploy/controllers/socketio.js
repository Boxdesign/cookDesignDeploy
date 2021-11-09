 

 /**
 * @api {post} /socketio/send Send message with socket.io
 * @apiGroup {socketio}
 * @apiName Send socket message
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Data:
 {	
	"token" : "57e245e373c49608114fd4c9",
	"message" : {
		"status": "ok",
		"url": "...",
		"type": "article",
		"params": [...]
	},
 }
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 **/ 

 exports.sendMessage = (req, res) => {
 	  
 	  var app = require('../app')
  	var io = app.io;
  	var data = req.body;
  	
  	var message = data.message;
  	var socketId = data.socket;

  	if (message.status == 'error') {
    
			  io.to(socketId).emit('cooksystem', {status: 'error'})

    } else if(message.status == 'success') {
	 			
			  io.to(socketId).emit('cooksystem', message)
		
		}
	  res.status(200).end();
}