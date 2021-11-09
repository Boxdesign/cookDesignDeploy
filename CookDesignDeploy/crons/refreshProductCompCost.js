var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '0 8 * * 6' : '0 4 * * *' //Prod “At 08:00 UTC on Saturday.”, dev every 5 min
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '0 8 * * 6'  //Prod “At 08:00 UTC on Saturday.”
	break;

	case 'staging':
			schedule = '0 8 * 12 6'
	break;

	default:
		schedule = '0 4 * * *'
	break
}

exports.refreshProductCompCostTask = cron.schedule(schedule, () => {

	var refreshRecipesCompCosts = require('../queues/refreshRecipesCompCosts')

  refreshRecipesCompCosts.refreshRecipesCompCosts(
    {
      title: 'Refresh Product Composition Costs ',
      model: 'Product' 
    }
  ); 

})