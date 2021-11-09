'use strict';

var express = require('express');
var router = express.Router();


const mealElem = require('../controllers/mealElement_lib');

router.post('/', mealElem.add);

router.put('/', mealElem.edit);

router.get('/', mealElem.getAll);

router.delete('/', mealElem.remove);

module.exports = router;
