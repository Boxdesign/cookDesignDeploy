var kue = require("kue")
var config = require('../config/config');
var async = require('async');
var moment = require('moment')

exports.cleanUpCompletedJobs = (req, res) => {

	  let jobsRemoved = 0;

		kue.Job.rangeByState( 'complete', 0, 50000, 'asc', function( err, jobs ) {
		  
			if(jobs.length) {
				
				async.eachSeries(jobs, (job, cb) => {

						let removeDate = moment(Number(job.created_at)).add(config.kue.completedJobMaxAge, config.kue.scale);
						let now = moment();
						//console.log(job.created_at)
						//console.log('remove date', removeDate.format('YYYY MM DD h:mm:ss a'))
						//console.log('now date', now.format('YYYY MM DD h:mm:ss a'))

					  if(removeDate.isBefore(now)) {

					    job.remove( ()=>{
					      jobsRemoved++;
								process.nextTick(()=>cb())
					    });

					  } else {
					  	process.nextTick(()=>cb())
					  }

			  }, ()=> {
						let message = 'Removed '+ jobsRemoved + ' completed jobs.'
						res.status(200).json(message).end(); 
				});

			} else {
				res.status(200).json("No jobs removed.").end(); 
			}	
			
		});

}

exports.cleanUpFailedJobs = (req, res) => {

	  let jobsRemoved = 0;

		kue.Job.rangeByState( 'failed', 0, 50000, 'asc', function( err, jobs ) {
		  
			if(jobs.length) {
				
				//console.log('There are ', jobs.length, ' failed jobs to remove.')

				async.eachSeries(jobs, (job, cb) => {

						let removeDate = moment(Number(job.created_at)).add(config.kue.failedJobMaxAge, config.kue.scale);
						let now = moment();

					  if(removeDate.isBefore(now)) {

					    job.remove( () => {
					    	jobsRemoved++;
								process.nextTick(()=>cb())
					    });
					  } else {
					  	process.nextTick(()=>cb())
					  }

			  }, ()=> {
						let message = 'Removed '+ jobsRemoved + ' failed jobs.'
						res.status(200).json(message).end(); 
				});

			} else {
				res.status(200).json("No jobs removed.").end(); 
			}	
			
		});
}


exports.cleanUpStuckJobs = (req, res) => {

		let removedJobs = 0;

		kue.Job.rangeByState( 'active', 0, 50000, 'asc', function( err, jobs ) {
		  
			if(jobs.length) {
				
				console.log('There are ', jobs.length, ' active jobs.')

				async.eachSeries(jobs, (job, cb) => {

						let created_at = new Date(Number(job.created_at))
						let delay_in_ms = Date.now() - created_at
						let delay_in_hours = delay_in_ms / (1000*3600)

						if(delay_in_hours > 0) { //Job more than 18 min old...remove!
								job.remove( function(){
						      removedJobs++;
									process.nextTick(()=>cb())
						    });
						} else {
							process.nextTick(()=>cb())
						}				    

			  }, ()=> {
						let message = 'Removed '+ removedJobs + ' stuck jobs.'
						res.status(200).json(message).end(); 
				});

			} else {
				res.status(200).json("No jobs to remove.").end(); 
			}	
			
		});

}

exports.cleanUpQueuedJobs = (req, res) => {

	  let jobsRemoved = 0;

		kue.Job.rangeByState( 'inactive', 0, 50000, 'asc', function( err, jobs ) {
		  
			if(jobs.length) {
				
				//console.log('There are ', jobs.length, ' inactive or queued jobs to remove.')

				async.eachSeries(jobs, (job, cb) => {

						let removeDate = moment(Number(job.created_at)).add(config.kue.queuedJobMaxAge, config.kue.scale);
						let now = moment();

					  if(removeDate.isBefore(now)) {

						    job.remove( () => {
					    		jobsRemoved++;
						      process.nextTick(()=>cb())
						    });
					  } else {
					  	process.nextTick(()=>cb())
					  }						    

			  }, ()=> {
						let message = 'Removed '+ jobsRemoved + ' inactive jobs.'
						res.status(200).json(message).end(); 
				});

			} else {
				res.status(200).json("No jobs removed.").end(); 
			}	
			
		});
}

