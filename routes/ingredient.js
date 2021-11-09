var express = require('express');
var router = express.Router();

//importamos controlador de usuarios
const ingredient = require('./../controllers/ingredient');


router.post('/', ingredient.add);

router.post('/quarter', ingredient.addQuartering);

router.put('/quarter', ingredient.editQuartering);

router.delete('/quarter', ingredient.deleteQuartering);

router.get('/', ingredient.getAll);

router.get('/quarter', ingredient.getAllQuarter);

router.get('/detail', ingredient.getDetail);

router.get('/lang', ingredient.getLang);

router.get('/resetnullprices', ingredient.resetNullPrices);

router.get('/forcerefresh', ingredient.forceRefresh);

router.get('/generatereferencenumber', ingredient.generateReferenceNumber);

router.get('/calcpricing', ingredient.ingLocBasedPricing);

router.put('/', ingredient.edit);

router.put('/batch', ingredient.editBatch);

router.delete('/', ingredient.remove);

router.get('/locprices', ingredient.getLocPrices);

router.get('/locallergens', ingredient.getLocAllergens);

router.get('/ingredientinrecipes', ingredient.getIngredientInRecipes);

router.get('/updatelocationcost', ingredient.updateLocCost)

router.delete('/ingredientinrecipes', ingredient.deleteIngredientInRecipeVersion);

router.delete('/all', ingredient.deleteAllIngredientInRecipes)

router.get('/refreshLocationCost', ingredient.refreshLocationCost)

router.get('/refreshQuarteringsCost', ingredient.refreshQuarteringsCost)

router.get('/refreshIngLocAllergens', ingredient.refreshIngLocAllergens)

module.exports = router;
