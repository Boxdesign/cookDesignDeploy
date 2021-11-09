var express = require('express');
var router = express.Router();

//importamos controlador 
const appRelease = require('./../controllers/appRelease');

router.get('/', appRelease.getAll);

module.exports = router;