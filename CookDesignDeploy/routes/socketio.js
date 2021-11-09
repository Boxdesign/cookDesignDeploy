'use strict';

var express = require('express');
var router = express.Router();

const socketio = require('../controllers/socketio');

router.post('/send', socketio.sendMessage);

module.exports = router;