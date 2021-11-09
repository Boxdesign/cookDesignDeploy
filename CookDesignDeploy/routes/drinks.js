var express = require('express');
var router = express.Router();

//importamos controlador 
const drink = require('./../controllers/drinks');

router.post('/', drink.add);

router.post('/version', drink.addVersion);

router.get('/', drink.getAll);

router.get('/lang', drink.getUserLang);

router.get('/version', drink.getVersion);

router.get('/version/cooksteps', drink.getCookingSteps);

router.get('/versions', drink.getAllVersions);

router.delete('/version',drink.removeVersion);

router.delete('/',drink.remove);

router.get('/version/active',drink.setAsActiveVersion);

router.get('/pricingrates',drink.getPricingRates);

router.get('/elements', drink.getElements);
 
router.get('/subproducts', drink.getSubproductsFilter);
 
router.get('/ingredients', drink.getIngredientsFilter);

router.get('/activeversion', drink.getActiveVersion);

router.get('/locationallergens', drink.getLocationAllergens);

router.get('/locationcost', drink.getLocationCost);

router.get('/duplicate', drink.duplicate);

router.get('/restrictpricingrate', drink.restrictPricingRate);

router.get('/resetnullcosts' , drink.resetNullCost);

router.get('/drinkingastrooffers' , drink.getDrinkInGastroOffers);

router.delete('/drinkingastrooffers', drink.deleteDrinkInGastroOffers);

router.delete('/all', drink.deleteAllDrinkInGastroOffers);

router.get('/generatereferencenumber', drink.generateReferenceNumber)

router.get('/refreshAllergens', drink.refreshAllergens)

router.get('/refreshCompCosts', drink.refreshCompCosts)

module.exports = router;