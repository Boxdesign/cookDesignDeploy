var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '00 20 * * 5' : '0 4 * * *' //Prod At 20:00 UTC on Friday / 01:30 CET, dev every 5 min
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '30 20 * * 5'  //Prod At 20:30 UTC on Friday
	break;

	case 'staging':
			schedule = '00 20 * 12 5'
	break;

	default:
		schedule = '0 4 * * *'
	break
}


exports.refreshIngLocCostTask = cron.schedule(schedule, () => {

	var refreshArticleLocCostQueue = require('../queues/refreshArticleLocCost')

  refreshArticleLocCostQueue.refreshArticleLocCost(
    {
      title: 'Refresh Ingredients Location Costs ',
      model: 'ingredient'
    }
  );

})
