var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '0 23 * * 1-4' : '0 4 * * *' //production at 23:00 UTC or 01:00 CET (Barcelona) and dev every 3 minutes
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.selentaMPWebService;
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '30 23 * * 1-4'  //production at 23:30 UTC or 01:30 CET (Barcelona)
	break;

	case 'staging':
			schedule = '30 23 * 12 1-4'
	break;

	default:
		schedule = '45 4 * * *'
	break
}


exports.updateMPTask = cron.schedule(schedule, () => {

	var selentaHelper = require('../helpers/selentaWebService')

	let localFile = false;

	selentaHelper.updateSelentaArticles(localFile, (err) => {
		if(err) logger.error(err)
		logger.info('Finished selentaMPWebService cron successfully.')
	})
})
