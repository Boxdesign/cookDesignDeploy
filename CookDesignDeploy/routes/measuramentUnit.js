var express = require('express');
var router = express.Router();

//importamos controlador de usuarios
const mu = require('./../controllers/measuramentUnit_lib');


router.get('/', mu.getAll);

router.get('/base', mu.getBaseUnits);

router.get('/details', mu.getLangsUnit);

router.post('/', mu.add);

router.put('/', mu.edit);

router.delete('/', mu.remove);

router.delete('/conversion', mu.removeConversionUnit);

router.get('/conversion', mu.getConversionTable);


module.exports = router;
