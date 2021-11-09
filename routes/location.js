var express = require('express');
var router = express.Router();

//importamos controlador de usuarios
const location = require('./../controllers/location');

//obtener usuarios
// router.get('/', locationº.getAll);


//Creamo la location
router.post('/', location.createLocation);

router.put('/', location.editLocation);

router.get('/', location.getUserLocations);

router.get('/all', location.getAllLocations);

router.get('/details', location.getLocationLang);

router.get('/provider', location.getProviderLocations);

router.delete('/', location.remove);

// router.post('/create', user.create);

// router.post('/create', user.create);

module.exports = router;
