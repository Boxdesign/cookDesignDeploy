var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '0 8 * * 7' : '0 4 * * *' //Prod “At 08:00 UTC on Sunday.”, dev every 5 min
var schedule;
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.refreshDrinkCompCost;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '0 8 * * 7'  //Prod “At 08:00 UTC on Sunday.”
	break;

	case 'staging':
			schedule = '0 8 * 12 7'
	break;

	default:
		schedule = '0 4 * * *'
	break
}

exports.refreshDrinkCompCostTask = cron.schedule(schedule, () => {

	var refreshRecipesCompCosts = require('../queues/refreshRecipesCompCosts')

  refreshRecipesCompCosts.refreshRecipesCompCosts(
    {
      title: 'Refresh Drink Composition Costs ',
      model: 'Drink' 
    }
  ); 
})