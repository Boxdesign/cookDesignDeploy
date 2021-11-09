var express = require('express');
var router = express.Router();

const product = require('./../controllers/product');

router.post('/', product.add);

router.post('/version', product.addVersion);

router.get('/', product.getAll);

router.get('/lang', product.getUserLang);

router.get('/version', product.getVersion);

router.get('/versions', product.getAllVersions);

router.delete('/version',product.removeVersion);

router.delete('/',product.remove);

router.get('/version/cooksteps', product.getCookingSteps);

router.get('/version/active',product.setAsActiveVersion);

router.get('/elements', product.getElements);

router.get('/subproducts', product.getSubproductsFilter);
 
router.get('/ingredients', product.getIngredientsFilter);

router.get('/activeversion', product.getActiveVersion);

router.get('/locationcost', product.getLocationCost);

router.get('/duplicate', product.duplicate);

router.get('/pricingrates',product.getPricingRates);

router.get('/locationallergens', product.getLocationAllergens);

router.get('/restrictpricingrate', product.restrictPricingRate);

router.get('/productingastrooffers', product.getProductInGastroOffers);

router.delete('/productingastrooffers', product.deleteProductInGastroOffers)

router.delete('/all', product.deleteAllProductInGastroOffers)

router.get('/generatereferencenumber', product.generateReferenceNumber);

router.get('/refreshAllergens', product.refreshAllergens);

router.get('/refreshCompCosts', product.refreshCompCosts);

router.get('/refreshPackCosts', product.refreshPackCosts);

module.exports = router;
