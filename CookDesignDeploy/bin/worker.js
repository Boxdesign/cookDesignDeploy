
var workerApp = require('../workerApp')
var loggerHelper = require('../helpers/logger');

const logger = loggerHelper.worker;
// const logger = winston.loggers.get('worker');
/* ---------------------------------------------------------------*/
/*											CRONS                                     */
/* ---------------------------------------------------------------*/


if(process.env.ORGANIZATION == 'Oilmotion') {

	logger.info('Organization is Oilmotion, execute Selenta crons.')

	var selentaIngWebService = require('../crons/selentaIngWebService')
	var selentaSubpWebService = require('../crons/selentaSubpWebService')
	var selentaDishWebService = require('../crons/selentaDishWebService')
	var selentaMPWebService = require('../crons/selentaMPWebService')
	var selentaUtensilWebService = require('../crons/selentaUtensilWebService')
	var selentaMasterDataWebService = require('../crons/selentaMasterDataWebService')

	selentaIngWebService.ingredientTask.start();
	selentaSubpWebService.subproductTask.start();
	selentaDishWebService.dishTask.start();
	selentaMPWebService.updateMPTask.start();
	selentaUtensilWebService.utensilTask.start();
	selentaMasterDataWebService.masterDataTask.start();
}



var cleanUpQueue = require('../crons/cleanUpQueue')
var refreshIngLocCost = require('../crons/refreshIngLocCost')
var refreshPackLocCost = require('../crons/refreshPackLocCost')
var refreshSubproductCompCost = require('../crons/refreshSubproductCompCost')
var refreshDishCompCost = require('../crons/refreshDishCompCost')
var refreshDrinkCompCost = require('../crons/refreshDrinkCompCost')
var refreshProductCompCost = require('../crons/refreshProductCompCost')
var refreshProductPackCost = require('../crons/refreshProductPackCost')
var refreshDishAllergens = require('../crons/refreshDishAllergens')
var refreshDrinkAllergens = require('../crons/refreshDrinkAllergens')
var refreshProductAllergens = require('../crons/refreshProductAllergens')
var refreshSubproductAllergens = require('../crons/refreshSubproductAllergens')
var refreshIngLocAllergens = require('../crons/refreshIngLocAllergens')

//var articleLocCostUpdate = require('../crons/articleLocCostUpdate')
cleanUpQueue.cleanUpQueueTask.start();
refreshIngLocCost.refreshIngLocCostTask.start();
refreshPackLocCost.refreshPackLocCostTask.start();
refreshSubproductCompCost.refreshSubproductCompCostTask.start();
refreshDishCompCost.refreshDishCompCostTask.start();
refreshDrinkCompCost.refreshDrinkCompCostTask.start();
refreshProductPackCost.refreshProductPackCostTask.start();
refreshProductCompCost.refreshProductCompCostTask.start();
refreshDishAllergens.refreshDishAllergensTask.start()
refreshDrinkAllergens.refreshDrinkAllergensTask.start()
refreshProductAllergens.refreshProductAllergensTask.start()
refreshSubproductAllergens.refreshSubproductAllergensTask.start()
refreshIngLocAllergens.refreshIngLocAllergensTask.start()
//articleLocCostUpdate.articleLocCostUpdateTask.start();

/* ---------------------------------------------------------------*/
/*												QUEUES                                  */
/* ---------------------------------------------------------------*/

var articleQueue = require('../queues/articleProcess')
var articleLocCostUpdateQueue = require('../queues/articleLocCostUpdateProcess')
var measUnitQueue = require('../queues/measUnitProcess')
var exportGastroQueue = require('../queues/exportGastroProcess')
var exportArticleQueue = require('../queues/exportArticleProcess')
var exportRecipeQueue = require('../queues/exportRecipeProcess')
var gastroCompCostQueue = require('../queues/gastroCompCostProcess')
var recipeCompCostQueue = require('../queues/recipeCompCostProcess')
var recipeConvCostQueue = require('../queues/recipeConvCostProcess')
var recipePackCostQueue = require('../queues/recipePackCostProcess')
var reportGastroIngredientsQueue = require('../queues/reportGastroIngredientsProcess')
var providerQueue = require('../queues/providerProcess')
var allergenQueue = require('../queues/allergenProcess')
var reportGastroIngredientsByLocationQueue = require('../queues/reportGastroIngredientsByLocationProcess')
var refreshRecipesCompCostsQueue = require('../queues/refreshRecipesCompCostsProcess')
var refreshProductsPackCostsQueue = require('../queues/refreshProductsPackCostsProcess')
var refreshQuarteringCostsQueue = require('../queues/refreshQuarteringCostsProcess')
var refreshAllergensQueue = require('../queues/refreshAllergensProcess')
var refreshArticleLocCostQueue = require('../queues/refreshArticleLocCostProcess')
var printBookQueue = require('../queues/printBookProcess')
var subproductsInLocationQueue = require('../queues/subproductsInLocationProcess')
var subproductsInLocationDetailedQueue = require('../queues/subproductsInLocationDetailedListProcess')
var removeImageQueue = require('../queues/removeImageProcess')
var refreshIngLocAllergens = require('../queues/refreshIngLocAllergensProcess')
var refreshLocAllergens = require('../queues/refreshLocAllergensProcess')
var recipeCompCostAllergensQueue = require('../queues/recipeCompAllergensProcess')

logger.info('////////////////////////////////////////////////////////////')
logger.info('/////////             Job queues started...        /////////')
logger.info('/////////             Crons started...             /////////')
logger.info('////////////////////////////////////////////////////////////')
logger.info('/////////                                          /////////')
logger.info('/////////             Worker started               /////////')
logger.info('/////////                                          /////////')
logger.info('////////////////////////////////////////////////////////////')
logger.info('////////////////////////////////////////////////////////////')
/*
require("events").EventEmitter.defaultMaxListeners= 0;
process.removeAllListeners();
*/
