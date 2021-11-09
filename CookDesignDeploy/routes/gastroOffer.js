var express = require('express');
var router = express.Router();

//importamos controlador 
const gastroOffer = require('./../controllers/gastroOffer');

router.post('/', gastroOffer.add);

router.post('/version', gastroOffer.addVersion);

router.get('/', gastroOffer.getAll);

router.get('/lang', gastroOffer.getUserLang);

router.get('/version', gastroOffer.getVersion);

router.get('/versions', gastroOffer.getAllVersions);

router.get('/locationcost', gastroOffer.getLocationCost);

router.delete('/version',gastroOffer.removeVersion);

router.delete('/',gastroOffer.remove);

router.get('/version/active',gastroOffer.setAsActiveVersion);

router.get('/activeversion', gastroOffer.getActiveVersion);

router.get('/duplicate', gastroOffer.duplicate);

router.get('/generatereferencenumber', gastroOffer.generateReferenceNumber)

router.get('/checkItemsLocation', gastroOffer.checkItemsLocation)

module.exports = router;