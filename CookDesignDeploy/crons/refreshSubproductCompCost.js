var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '0 0 * * 6' : '0 4 * * *' //Prod at 00:00 UTC on Saturday, dev every 5 min
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '0 0 * * 6'  //Prod at 00:00 UTC on Saturday
	break;

	case 'staging':
			schedule = '0 0 * 12 6'
	break;

	default:
		schedule = '0 4 * * *'
	break
}

exports.refreshSubproductCompCostTask = cron.schedule(schedule, () => {

	var refreshRecipesCompCosts = require('../queues/refreshRecipesCompCosts')

  refreshRecipesCompCosts.refreshRecipesCompCosts(
    {
      title: 'Refresh Subproduct Composition Costs ',
      model: 'Subproduct' 
    }
  ); 

})