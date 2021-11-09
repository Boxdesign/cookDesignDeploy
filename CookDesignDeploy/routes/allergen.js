'use strict';

var express = require('express');
var router = express.Router();

const allergen = require('../controllers/allergen_lib');

router.post('/', allergen.add);

router.put('/',  allergen.edit);

router.get('/', allergen.getAll);

router.get('/details', allergen.getAllergenLang);

router.delete('/', allergen.remove);

router.get('/generatereferencenumber', allergen.generateReferenceNumber)

module.exports = router;
