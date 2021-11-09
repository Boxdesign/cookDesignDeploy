
var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '0 0 * * 1-4' : '0 4 * * *' //Prod at 0:00 UTC or 2am CET / dev every hour
var schedule;
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.articleLocCostUpdate;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '0 0 * 12 1-4'  //At 0:00 UTC or 2am CET
	break;

	case 'staging':
			schedule = '0 0 * 12 1-4'
	break;

	default:
		schedule = '0 4 * 12 *'
	break
}

exports.articleLocCostUpdateTask = cron.schedule(schedule, () => {

	var async = require('async');
	var articleLocCostUpdateQueue = require('../queues/articleLocCostUpdate')

	logger.info('Entering article location cost update cron.')

 	async.waterfall([

 		(cb) => {

			var job = articleLocCostUpdateQueue.articleLocCostUpdate(
				{
					title: 'ArticleLocCostUpdate - Calculate article location cost array.'
				}
			);

			logger.info('Added new task to queue.');

			cb(null, true)	

 		}], (err, doc) => {
			if(err) { 
				 logger.error('Error during cron process: %s', err.message);
			} else {
				 logger.info('cron process completed successfully.');
			}
 		})

})