'use strict';

var express = require('express');
var router = express.Router();


const gastro = require('../controllers/gastroFamily_lib');

router.post('/', gastro.add);

router.put('/', gastro.edit);

router.get('/', gastro.getAll);

router.delete('/', gastro.remove);

router.get('/generatereferencenumber', gastro.generateReferenceNumber)

module.exports = router;
