var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '30 6 * * *' : '0 4 * * *' //Prod at 6:30 am UTC or 8:30 CET / dev every hour
var schedule;
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.cleanUpQueue;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '30 6 * * *'  //at 6:30 am UTC or 8:30 CET
	break;

	case 'staging':
			schedule = '30 6 * 12 *'
	break;

	default:
		schedule = '0 4 * * *'
	break
}

exports.cleanUpQueueTask = cron.schedule(schedule, () => {

	var async = require('async');
	var kue = require("kue")
	var config = require('../config/config');
	var async = require('async');	
	var moment = require('moment');

	logger.info('Entering clean up queue cron.')

 	async.waterfall([

 		(cb) => { //Clean up completed jobs older than threshold

  		  let jobsRemoved = 0;

				kue.Job.rangeByState( 'complete', 0, 50000, 'asc', function( err, jobs ) {

					if(err) {
						logger.error('Error retrieving completed jobs')
						logger.error(err)
						cb(null, true)
					}
				  
					if(jobs.length) {

							logger.info('Retrieved %s completed jobs to potentially remove.', jobs.length)

							async.eachSeries(jobs, (job, cb) => {

								let removeDate = moment(Number(job.created_at)).add(config.kue.completedJobMaxAge, config.kue.scale);
								let now = moment();
								
					  		if(removeDate.isBefore(now)) { //Remove

								    job.remove( function(){
								    	jobsRemoved++;
											process.nextTick(()=>cb())
								    });

								} else { //Do not remove
									process.nextTick(()=>cb())
								}

					  }, ()=> {
								logger.info('Removed '+ jobsRemoved + ' completed jobs.')
								cb(null, true)
						});

					} else {

						logger.info('No completed jobs to remove.')
						cb(null, true)
					}	
				
				});


		}, (doc, cb) => { //Remove failed jobs older than threshold

  		  	let jobsRemoved = 0;

					kue.Job.rangeByState( 'failed', 0, 50000, 'asc', function( err, jobs ) {

							if(err) {
								logger.error('Error retrieving failed jobs')
								logger.error(err)
								cb(null, true)
							}

							if(jobs.length) {
								
								logger.info('Retrieved %s failed jobs to potentially remove.', jobs.length)

								async.eachSeries(jobs, (job, cb) => {

									let removeDate = moment(Number(job.created_at)).add(config.kue.failedJobMaxAge, config.kue.scale);
									let now = moment();
									
						  		if(removeDate.isBefore(now)) { //Remove

								    job.remove( () => {
								    	jobsRemoved++;
											process.nextTick(()=>cb())
								    });

									} else { //Do not remove
										process.nextTick(()=>cb())
									}

							  }, ()=> {
										logger.info('Removed '+ jobsRemoved + ' failed jobs.');
										cb(null, true)
								});

							} else {
								logger.info("No failed jobs removed.");
								cb(null, true)
							}	
					
				});
			

 		}], (err, doc) => {
			if(err) { 
				 logger.error('Error during cron process: %s', err.message);
			} else {
				 logger.info('Cron process completed successfully.');
			}
 		})

})