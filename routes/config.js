'use strict';

var express = require('express');
var router = express.Router();


const configController = require('../controllers/config');

router.get('/languages', configController.getAllLanguages);

router.get('/tax', configController.getTax);

router.get('/entity', configController.getEntity);

router.get('/organization', configController.getOrganization);

router.get('/isocodes', configController.getIsoCodes);

router.get('/timeintervals', configController.getTimeIntervals);

router.get('/cookingstepstimeunits', configController.getcookingStepsTimeUnits);

module.exports = router;
