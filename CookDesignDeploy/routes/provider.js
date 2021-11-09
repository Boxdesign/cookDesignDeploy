'use strict';

var express = require('express');
var router = express.Router();

const provider = require('../controllers/provider');

router.post('/', provider.add);

router.get('/', provider.getAll);

router.get('/detail', provider.get);

router.put('/', provider.edit);

router.delete('/', provider.remove);

module.exports = router;