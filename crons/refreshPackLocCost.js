var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '00 22 * * 5' : '0 4 * * *' //Prod At 22:00 UTC on Friday / 01:30 CET, dev every 5 min
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '00 22 * * 5'  //Prod At 22:00 UTC on Friday 
	break;

	case 'staging':
			schedule = '00 22 * 12 5'
	break;

	default:
		schedule = '0 4 * * *'
	break
}


exports.refreshPackLocCostTask = cron.schedule(schedule, () => {

	var refreshArticleLocCostQueue = require('../queues/refreshArticleLocCost')

  refreshArticleLocCostQueue.refreshArticleLocCost(
    {
      title: 'Refresh Packagings Location Costs ',
      model: 'packaging'
    }
  );
})