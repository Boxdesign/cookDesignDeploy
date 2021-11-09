var express = require('express');
var router = express.Router();

const report = require('./../controllers/report');

router.get('/gastroingredients', report.getGastroIngredients);

router.get('/ingredientsbylocation', report.getIngredientsByLocation)

router.get('/subproductsinlocation', report.printSubproductsInLocationSimpleList);

router.get('/subproductsinlocationDetailed', report.printSubproductsInLocationDetailedList);

module.exports = router;
