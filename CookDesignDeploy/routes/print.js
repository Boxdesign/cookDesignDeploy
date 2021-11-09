var express = require('express');
var router = express.Router();

//importamos controlador de usuarios
const print = require('./../controllers/print');


router.get('/article', print.printArticle);

router.get('/product', print.printProduct);

router.get('/subproduct', print.printSubproduct);

router.get('/dish', print.printDish);

router.get('/drink', print.printDrink);

router.get('/gastro-offer', print.printGastroOffer);

router.get('/allergen', print.printAllergenInGastroOffer);

router.get('/library', print.printLibrary);

module.exports = router;
