var kue = require("kue")
var config = require('../config/config');
var async = require('async');

const queue = kue.createQueue({redis: config.redisUrl});


kue.Job.rangeByState( 'complete', 0, 1000, 'asc', function( err, jobs ) {
  
	if(jobs.length) {
		
		console.log('There are ', jobs.length, ' completed jobs to remove.')

		async.eachSeries(jobs, (job, cb) => {

		    job.remove( function(){
		      console.log( 'removed ', job.id );
					cb()
		    });

	  }, ()=> {
				console.log("All jobs removed.")
				process.exit();
		});

	} else {
		console.log('No jobs to remove')
		process.exit();
	}	
	
});