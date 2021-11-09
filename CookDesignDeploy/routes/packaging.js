'use strict';

var express = require('express');
var router = express.Router();


const packaging = require('../controllers/packaging');

router.post('/', packaging.add);

router.put('/', packaging.edit);

router.get('/', packaging.getAll);

router.get('/detail', packaging.getDetail);

router.get('/lang', packaging.getPackagingLang);

router.delete('/', packaging.remove);

router.get('/locprices', packaging.getLocPrices);

router.get('/packaginginproducts', packaging.getPackagingInProducts)

router.delete('/packaginginproducts', packaging.deletePackagingInProductVersion)

router.get('/generatereferencenumber', packaging.generateReferenceNumber)

router.get('/updatelocationcost', packaging.updateLocCost)

router.delete('/all', packaging.deleteAllPackagingInRecipes)

router.get('/refreshLocationCost', packaging.refreshLocationCost)

module.exports = router;
