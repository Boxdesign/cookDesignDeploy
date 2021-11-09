'use strict';

var express = require('express');
var router = express.Router();


const article = require('../controllers/article');

router.post('/', article.add);

router.get('/', article.getAll);

router.get('/articlesbyprovider', article.articlesByProvider);

router.get('/detail', article.get);

router.put('/', article.edit);

router.get('/changehasdatasheet', article.changeHasDataSheet);

router.get('/updateallhasdatasheet', article.updateAllHasDataSheet);

router.get('/ingredients', article.getIngredients);

router.delete('/', article.remove);

module.exports = router;