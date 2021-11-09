var express = require('express');
var router = express.Router();

//importamos controlador 
const dish = require('./../controllers/dish');

router.post('/', dish.add);

router.post('/version', dish.addVersion);

router.get('/', dish.getAll);

router.get('/lang', dish.getUserLang);

router.get('/version', dish.getVersion);

router.get('/version/cooksteps', dish.getCookingSteps);

router.get('/versions', dish.getAllVersions);

router.delete('/version',dish.removeVersion);

router.delete('/',dish.remove);

router.get('/version/active',dish.setAsActiveVersion);

router.get('/pricingrates',dish.getPricingRates);

router.get('/elements', dish.getElements);
 
router.get('/subproducts', dish.getSubproductsFilter);
 
router.get('/ingredients', dish.getIngredientsFilter);

router.get('/activeversion', dish.getActiveVersion);

router.get('/locationcost', dish.getLocationCost);

router.get('/locationallergens', dish.getLocationAllergens);

router.get('/duplicate', dish.duplicate);

router.get('/duplicateIntoSubproduct', dish.duplicateIntoSubproduct);

router.get('/restrictpricingrate', dish.restrictPricingRate);

router.get('/resetnullcosts' , dish.resetNullCost);

router.get('/dishingastrooffers' , dish.getDishInGastroOffers);

router.delete('/dishingastrooffers',dish.deleteDishInGastroOffers)

router.delete('/all', dish.deleteAllDishInGastroOffers);

router.get('/generatereferencenumber', dish.generateReferenceNumber);

router.get('/refreshAllergens', dish.refreshAllergens)

router.get('/refreshCompCosts', dish.refreshCompCosts)

module.exports = router;
