var express = require('express');
var router = express.Router();

//importamos controlador 
const dataExport = require('./../controllers/export');

router.get('/gastro-offer', dataExport.gastroOffer);

router.get('/recipe', dataExport.recipe);

router.get('/article', dataExport.article);

router.get('/family', dataExport.family)

router.get('/dish', dataExport.dish)

router.get('/gastro', dataExport.gastro)

module.exports = router;