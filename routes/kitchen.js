'use strict';

var express = require('express');
var router = express.Router();


const kitchen = require('../controllers/kitchen');

router.post('/', kitchen.add);

router.post('/workRoom', kitchen.addWorkRoom);

router.put('/', kitchen.edit);

router.put('/workRoom', kitchen.editWorkRoom);

router.get('/', kitchen.getKitchens);

router.get('/details', kitchen.getKitchenLang);

router.get('/workRoom/details', kitchen.getWorkRoomLang);

router.delete('/', kitchen.remove);

router.delete('/workRoom', kitchen.removeWorkRoom);

router.get('/assignKitchenToOrganizationLoc',kitchen.assignKitchenToOrganizationLoc);

module.exports = router;