'use strict';

var express = require('express');
var router = express.Router();


const packFormat = require('../controllers/packFormat');

router.post('/', packFormat.add);

router.put('/', packFormat.edit);

router.get('/', packFormat.getAll);

router.get('/detail', packFormat.getDetail);

router.get('/lang', packFormat.getPackFormatLang);

router.delete('/', packFormat.remove);

router.get('/generatereferencenumber', packFormat.generateReferenceNumber)

module.exports = router;
