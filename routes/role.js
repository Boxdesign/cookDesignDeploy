'use strict';

var express = require('express');
var router = express.Router();

const role = require('./../controllers/role');

router.get('/entities', role.getEntities);

router.post('/', role.createRole);

router.put('/', role.edit);

router.get('/detail', role.getRole);

router.get('/', role.getAll);

router.delete('/', role.remove);

module.exports = router;
