var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '0 14 * * 6' : '0 4 * * *' //Prod At 14:00 on Saturday, dev every 5 min
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '0 14 * * 6'  //Prod At 14:00 on Saturday
	break;

	case 'staging':
			schedule = '0 14 * 12 6'
	break;

	default:
		schedule = '0 4 * * *'
	break
}


exports.refreshProductPackCostTask = cron.schedule(schedule, () => {

  var refreshProductsPackCosts = require('../queues/refreshProductsPackCosts')

  refreshProductsPackCosts.refreshProductsPackCosts(
    {
      title: 'Refresh Product Packaging Costs '
    }
  );  

})