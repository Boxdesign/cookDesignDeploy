'use strict';

var express = require('express');
var router = express.Router();


const process = require('../controllers/process_lib');

router.post('/', process.add);

router.put('/', process.edit);

router.get('/', process.getAll);

router.get('/details', process.getProcessLang);

router.delete('/', process.remove);

router.get('/generatereferencenumber', process.generateReferenceNumber)

module.exports = router;
