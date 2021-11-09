

exports.check = () => {

	var config = require('../config/config');
  var async = require('async')
 	var request = require('request');
 	var access_token = config.github.accessToken;
 	var appVersionList;
 	var loggerHelper = require('../helpers/logger');
	const logger = loggerHelper.appRelease;
 	var appVersionBulkWrite;
 	var AppRelease = require('../models/appRelease')
 	var githubAppReleases;
 	var savedAppReleases;
 	var latestGithubRelease;
 	var latestSavedRelease;
 	var app = require('../app');
	var io = app.io;

 	logger.info('Starting appVersion check...')

 	async.waterfall([

 		(cb) => { //Get list of github releases

	 		request.get(
			{
				url: config.github.repoUrl,
				json: true, 
				headers: {
				    'User-Agent': config.github.organization
				},			
				qs: { 
					access_token: access_token,
					type: 'private'
				}						
			}, (err, res, body) => {

				 if(err) {
				 	logger.error('Error retrieving list of releases')
				 	logger.error(err)
				 	return cb(err)
				 }

				 githubAppReleases = body;
				 if(githubAppReleases.length) latestGithubRelease=githubAppReleases[0];
				 else latestGithubRelease = {id: ''}
				 //console.log(latestGithubRelease, 'latestGithubRelease')
				 logger.info('Found %s releases in repo', githubAppReleases.length)
				 //console.log(githubAppReleases)
				 cb(null, true)
			})

 		}, (doc, cb) => { //Get saved releases

 			 AppRelease.find()
 			 .sort({published_at: -1})
 			 .exec((err, docs) => {
	 			 	if(err) return cb(err)
	 			 	savedAppReleases = docs;
	 			  if(savedAppReleases.length) latestSavedRelease = savedAppReleases[0];
  				else latestSavedRelease = {githubId: ''}
	 			  //console.log(latestSavedRelease, 'latestSavedRelease')
	 			 	cb(null,true)
 			 })

 		}, (doc, cb) => { //Add new releases and update existing ones

 			 	async.eachSeries(githubAppReleases, (githubAppRelease, cb_async) => {

 			 		let release = savedAppReleases.find((savedAppRelease) => {
 			 			return githubAppRelease.id == savedAppRelease.githubId
 			 		})
 			 		if(!release) {
 			 			//Save new release to database
 			 			let newRelease = new AppRelease();
 			 			newRelease.githubId = githubAppRelease.id;
 			 			newRelease.tag_name = githubAppRelease.tag_name;
 			 			newRelease.name = githubAppRelease.name;
 			 			newRelease.published_at = new Date(githubAppRelease.published_at);
 			 			newRelease.body = githubAppRelease.body;
 			 			newRelease.prerelease = githubAppRelease.prerelease;

 			 			newRelease.save((err, doc) => {
 			 				if(err) return cb_async(err)
 			 				console.log('Added release ', doc.id)
 			 				cb_async()
 			 			}) 			 			
 			 		}
 			 		else
 			 		{
 			 			//Update existing relase information
 			 			release.tag_name = githubAppRelease.tag_name;
 			 			release.name = githubAppRelease.name;
 			 			release.published_at = new Date(githubAppRelease.published_at);
 			 			release.body = githubAppRelease.body;
 			 			release.prerelease = githubAppRelease.prerelease;

 			 			release.save((err, doc) => {
 			 				if(err) return cb_async(err)
 			 				console.log('Updated release ', doc.githubId)

 			 				cb_async()
 			 			})
 			 		}

 			 	}, (err) => {
 			 		if(err) return cb(err)
 			 		cb(null, true)
 			 	})

 		}, (doc, cb) => { //Check for deleted releases

 			 	async.eachSeries(savedAppReleases, (savedAppRelease, cb_async) => {

 			 		let release = githubAppReleases.find((githubAppRelease) => {
 			 			return githubAppRelease.id == savedAppRelease.githubId
 			 		})

					if(!release) {
 			 			//Delete release from database
 			 			savedAppRelease.remove((err, doc) => {
 			 				if(err) return cb_async(err)
 			 				console.log('Deleted release ', doc.githubId)
 			 				cb_async()
 			 			})
 			 		}
 			 		else
 			 		{
						process.nextTick(() => cb_async()) 			 		
					}

 			 	}, (err) => {
 			 		if(err) return cb(err)
 			 		cb(null, true)
 			 	})

 		}, (doc, cb) => { //Notifiy users if the latest release has changed

 			 if(latestSavedRelease.githubId == latestGithubRelease.id) {
 			 	 logger.info('Latest release has not changed, skip.')
 			 	 console.log('Latest release has not changed, skip.')
 			 	 cb(null, true)
 			 }
 			 else
 			 {
 			 	logger.info('Lastest release has changed. Notify users.')
 			 	console.log('Lastest release has changed. Notify users.')

 			 	//Wait some time (1 min) so that client sockets can reconnect and authenticate back again
 			 	setTimeout(() => {
	 			 	//Broadcast message to all connected sockets
	 			 	let message = {
	        	status: 'success', 
	        	type: 'newAppRelease',
	        	newRelease: latestGithubRelease.name
	        }
	 			 	io.emit('cooksystem', message)		 		
 			 	}, 60000)
 			 }

 		}], (err, doc) => {
 			if(err) {
 				if(err == true) logger.info('Finished appVersion method.')
 				else logger.error(err)
 			}
 			else
 			{
 				logger.info('Finished appVersion method.')
 			}
 	})	

}