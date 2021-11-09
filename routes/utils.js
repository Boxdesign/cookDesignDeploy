
'use strict';

var express = require('express');
var router = express.Router();

const utils = require('./../controllers/utils');

router.get('/recipes-delete-versions', utils.deleteRecipesNonActiveVersions);

router.get('/gastros-delete-versions', utils.deleteGastroOfferNonActiveVersions);

router.get('/extractProviderArticlesInLocation', utils.extractProviderArticlesInLocation)

router.get('/flagRecursiveLoopsInSubproducts', utils.flagRecursiveLoopsInSubproducts)

router.get('/deleteRecipesWithoutActiveVersion', utils.deleteRecipesWithoutActiveVersion)

router.get('/migrateGithubIssues', utils.migrateGithubIssues) 

router.get('/migrateGithubIssuesToXls', utils.migrateGithubIssuesToXls) 

router.get('/removeDuplicatedLocs', utils.removeDuplicatedLocs)

router.get('/selentaWebMPServiceCheck', utils.selentaWebMPServiceCheck)

router.get('/assignAllergenCode', utils.assignAllergenCode)

router.get('/selentaMPWebService', utils.selentaMPWebService)

router.get('/duplicateInNewDatabaseIngredient', utils.duplicateInNewDatabaseIngredient)

router.get('/duplicateInNewDatabaseAllergen', utils.duplicateInNewDatabaseAllergen)

router.get('/duplicateInNewDatabaseUtensil', utils.duplicateInNewDatabaseUtensil)

router.get('/familyWithLocsAndGastroOffers', utils.exportFamiliesWithLocsAndGastroOffers)

router.get('/familyWithLocsAndRecipes', utils.exportFamilyRecipeWithLocsAndDishesAndDrinks)

router.get('/removeErroneousCompItemsInRecipe', utils.removeErroneousCompItemsInRecipe)

router.get('/replaceCompElementInRecipes', utils.replaceCompElementInRecipes)

router.get('/replaceS3BucketInGalleryDocs', utils.replaceS3BucketInGalleryDocs);

router.get('/translate', utils.translate);

router.get('/translatev2', utils.translateV2);

router.get('/translatev3', utils.translatev3);

router.get('/translatev4', utils.translatev4);

router.get('/translatev5', utils.translatev5);

router.get('/translatev6', utils.translatev6);

router.get('/translateReport', utils.excelReport);
module.exports = router;
