'use strict';

var express = require('express');
var router = express.Router();


const check = require('../controllers/checkpoint_lib');

router.post('/', check.add);

router.put('/', check.edit);

router.get('/', check.getAll);

router.get('/details', check.getCheckpointLang);

router.delete('/', check.remove);

router.get('/generatereferencenumber', check.generateReferenceNumber)

router.delete('/deletecheckpointsincooksteps', check.deleteCheckpointsInCookingSteps)

module.exports = router;
