'use strict';

var express = require('express');
var router = express.Router();


const selentaController = require('../controllers/selentaImport');

router.get('/newArticles', selentaController.getSelentaSapNewArticles);

router.get('/newProviders', selentaController.getSelentaSapNewProviders);

router.get('/deletedArticles', selentaController.getSelentaSapDeletedArticles);

router.get('/deletedProviders', selentaController.getSelentaSapDeletedProviders);

router.get('/updatedArticles', selentaController.getSelentaSapUpdatedArticles);

router.get('/articlesConflicts', selentaController.getSelentaSapArticlesConflicts);

router.get('/downloadSapArticles', selentaController.downloadSelentaSapArticles);

router.get('/articles', selentaController.getSelentaSapArticles);

router.get('/article', selentaController.getSelentaSapArticle);

router.get('/providers', selentaController.getSelentaSapProviders);

router.delete('/newArticles', selentaController.removeSelentaSapNewArticle);

router.delete('/', selentaController.removeSelenta);

router.get('/family', selentaController.getSelentaRecipeFamilies)

router.get('/familycookdesign', selentaController.getSelentaCookDesignFamilies)

module.exports = router;