var express = require('express');
var router = express.Router();

//importamos controlador de usuarios
const printBook = require('./../controllers/printBook');

router.get('/gastro-offer', printBook.printGastroOfferBook);

module.exports = router;