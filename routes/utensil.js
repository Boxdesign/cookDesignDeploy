'use strict';

var express = require('express');
var router = express.Router();


const utensil = require('../controllers/utensil_lib');

router.post('/', utensil.add);

router.put('/', utensil.edit);

router.get('/', utensil.getAll);

router.get('/details', utensil.getUtensilLang);

router.get('/detailversion', utensil.getUtensil);

router.delete('/', utensil.remove);

router.get('/generatereferencenumber', utensil.generateReferenceNumber)

module.exports = router;
