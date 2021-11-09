var express = require('express');
var router = express.Router();

//importamos controlador 
const subproduct = require('./../controllers/subproduct');


router.post('/', subproduct.add);

router.post('/version', subproduct.addVersion);

router.get('/', subproduct.getAll);

router.get('/lang', subproduct.getUserLang);

router.get('/version', subproduct.getVersion);

router.get('/version/cooksteps', subproduct.getCookingSteps);

router.get('/versions', subproduct.getAllVersions);

router.delete('/version',subproduct.removeVersion);

router.delete('/',subproduct.remove);

router.get('/version/active',subproduct.setAsActiveVersion);

router.get('/activeversion', subproduct.getActiveVersion);

router.get('/locationcost', subproduct.getLocationCost);

router.get('/duplicate', subproduct.duplicate);

router.get('/duplicateIntoDish', subproduct.duplicateIntoDish);

router.get('/resetnullcosts' , subproduct.resetNullCost);

router.get('/locationallergens', subproduct.getLocationAllergens);

router.get('/resetunitcosts' , subproduct.resetUnitCost);

router.get('/subproductinrecipes', subproduct.getSubproductInRecipes)

router.delete('/subproductinrecipes', subproduct.deleteSubproductInRecipeVersion)

router.delete('/all',subproduct.deleteAllSubproductInRecipes)

router.get('/generatereferencenumber', subproduct.generateReferenceNumber)

router.get('/elements', subproduct.getElements);

router.get('/subproducts', subproduct.getSubproductsFilter);

router.get('/ingredients', subproduct.getIngredientsFilter);

router.get('/refreshAllergens', subproduct.refreshAllergens);

router.get('/refreshCompCosts', subproduct.refreshCompCosts);


module.exports = router;
