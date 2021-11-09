var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueRefreshProductsPackCosts;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('refreshProductsPackCosts', function(job, done){
    var totalNumProducts;
    var productCount=0;
    var costHelper = require('../helpers/cost')
    var locHelper = require('../helpers/locations');
    var erroneousTotalLocCosts=0;
    var erroneousTotalLocCostsNames = [];
    var erroneousPackagingCosts=0;
    var erroneousPackagingCostsNames = [];
    var erroneousPackagingLocationCosts=0;
    var erroneousPackagingLocationCostsNames = [];
    var responseMessage;
    var match = 0;
    var Product = require('../models/product');
    var costs;
    var totalLocCost;
    var computedPackCost;
    var computedTotalLocCost;  
    var activeVersion;  
    var product;

    async.waterfall([

      (cb)=> {
        Product.count({}, (err, count) => {
          if(err) return cb(err)
          totalNumProducts = count;
          cb(null, true)
        })
      }, (doc, cb) => {

        async.during(
        (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
          return callback(null, productCount < totalNumProducts);
        },
        (callback) => {

          Product
          .findOne({})
          .skip(productCount)
          .limit(1)
          .exec((err, doc) => {

          	if(err) return cb(err)

           	product = doc;          	
          	activeVersion = product.versions.find((version) => {return version.active == true})

            productCount++;
            let erroneousPackCost = false;

            async.waterfall([

      				(cb_2)=> {

		            costHelper.calculateRecipePackLocationCosts(activeVersion, product.location, Product, (err, costs) => {
		              
		              if(err) {
		                logger.error('Error computing packaging costs of product with id %s', product._id)
		                cb_2(null, true);
		              } else {
		              	computedPackCost = costs;

                		//-------------------------------Compare computed costs with actual recipe costs---------------------------------------
                		//-- Compare unit costs

		                if (activeVersion.packagingCost != costs.packagingCost ) {
		                  erroneousPackagingCosts++  
		                  erroneousPackCost=true;
		                  let errPackagingCost = {
		                    id: product._id,
		                    name: activeVersion.lang[0].name,
		                    actualPackagingCost: activeVersion.packagingCost,
		                    computedPackagingCost:costs.packagingCost
		                  }
		                  erroneousPackagingCostsNames.push(errPackagingCost);
		                  logger.warn('Computed packaging costs of %s are different!', activeVersion.lang[0].name)
		                }                 

		                // console.log(costs.packLocCost, 'costs.packLocCost')
		                // console.log(activeVersion.packLocCost, 'activeVersion.packLocCost')

		                if (activeVersion.packLocCost.length == costs.packLocCost.length) {
		                  match = 0;
		                  activeVersion.packLocCost.forEach((packLocCost1) => {
		                    costs.packLocCost.forEach((packLocCost2) => {
		                      let loc1Id=new ObjectId(packLocCost1.location);
		                      let loc2Id=new ObjectId(packLocCost2.location);
		                      if (loc2Id.equals(loc1Id) ) {
		                        if (packLocCost1.unitCost==packLocCost2.unitCost ) {
		                          match ++
		                        }
		                      }
		                    })
		                  })
		                  if (match != activeVersion.packLocCost.length) {
		                    erroneousPackagingLocationCosts++
   		                  erroneousPackCost=true;
		                    let errPackLocationCosts = {
		                      id: product._id,
		                      name: activeVersion.lang[0].name,
		                      actualLocationCost: activeVersion.packLocCost,
		                      computedLocationCost:costs.packLocCost
		                    }
		                    erroneousPackagingLocationCostsNames.push(errPackLocationCosts);
		                    logger.warn('Computed packaging location costs of %s are different! Actual loc costs: %j vs. computed loc costs: %j', activeVersion.lang[0].name, activeVersion.packLocCost,costs.packLocCost)
		                  }
		                } else {
		                  erroneousPackagingLocationCosts++;
		                  erroneousPackCost=true;
		                  let errPackLocationCosts = {
		                    id: product._id,
		                    name: activeVersion.lang[0].name,
		                    actualLocationCost: activeVersion.packLocCost,
		                    computedLocationCost:costs.packLocCost
		                  }
		                  erroneousPackagingLocationCostsNames.push(errPackLocationCosts);
		                  logger.warn('Computed packaging location costs of %s are different!', activeVersion.lang[0].name)
		                }  

		                cb_2(null, true)            
		              }		              

		            })

			        }, (doc, cb_2) => {

								locHelper.sumLocCostArrays(activeVersion.locationCost, computedPackCost.packLocCost, (err, totalLocCost) => {
		              
		              if(err) {
		                logger.error('Error computing packaging costs of product with id %s', product._id)
		                return cb_2(err);
		              } else {

		              	computedTotalLocCost = totalLocCost;

		                if (activeVersion.totalLocCost.length == totalLocCost.length) {
		                  match = 0;
		                  activeVersion.totalLocCost.forEach((totalLocCost1) => {
		                    totalLocCost.forEach((totalLocCost2) => {
		                      let loc1Id=new ObjectId(totalLocCost1.location);
		                      let loc2Id=new ObjectId(totalLocCost2.location);
		                      if (loc2Id.equals(loc1Id) ) {
		                        if (totalLocCost1.unitCost==totalLocCost2.unitCost ) {
		                          match ++
		                        }
		                      }
		                    })
		                  })
		                  if (match != activeVersion.totalLocCost.length) {
		                    erroneousTotalLocCosts++
   		                  erroneousPackCost=true;
		                    let errPackLocationCosts = {
		                      id: product._id,
		                      name: activeVersion.lang[0].name,
		                      actualLocationCost: activeVersion.totalLocCost,
		                      computedLocationCost:totalLocCost
		                    }
		                    erroneousTotalLocCostsNames.push(errPackLocationCosts);
		                    logger.warn('Computed packaging total location costs of %s are different!', activeVersion.lang[0].name)
		                  }
		                } else {
		                  erroneousTotalLocCosts++;
 		                  erroneousPackCost=true;
		                  let errPackLocationCosts = {
		                    id: product._id,
		                    name: activeVersion.lang[0].name,
		                    actualLocationCost: activeVersion.totalLocCost,
		                    computedLocationCost:totalLocCost
		                  }
		                  erroneousTotalLocCostsNames.push(errPackLocationCosts);
		                  logger.warn('Computed packaging total location costs of %s are different!', activeVersion.lang[0].name)
		                }

		                cb_2(null, true) 
		              }

		             })

				      }], (err, doc) => { //end of cb_2
				        	if(err) {
				        			logger.error(err)
				        			callback()
				        	} 
				        	else 
				        	{
				        		if(erroneousPackCost) {

	                    activeVersion.packagingCost = computedPackCost.packagingCost
	                    activeVersion.packLocCost = computedPackCost.packLocCost
	                    activeVersion.totalLocCost = computedTotalLocCost
						        	
			                product.save((err, doc) => {
			                  if(err) {
			                  	logger.error('Error saving product %s', product._id)
			                  	callback();
			                  }
			                  else
			                  {
			                  	logger.info('Product saved with updated cost')
			                  	let av = doc.versions.find((version) => {return version.active == true})
			                  	logger.info('Location cost for %s: %j', av.lang[0].name, av.locationCost)
			                  	callback()
			                  }
			                })
			              }
			              else
			              {
	              				logger.info('Product costs are correct, move on to next product.')
	              				callback()
			              }
				        	}

				        })

						})

        }, (err) => { // Finished looping through all products
          
          if(erroneousPackagingCosts>0) logger.error('There were', erroneousPackagingCosts, ' erroneous packaging cost from  ', totalNumProducts)
          if(erroneousPackagingLocationCosts>0) logger.error('There were', erroneousPackagingLocationCosts, ' erroneous location cost from  ', totalNumProducts)
          if(erroneousTotalLocCosts>0) logger.error('There were', erroneousTotalLocCosts, ' erroneous total location cost from  ', totalNumProducts)
          responseMessage = "There were " + erroneousPackagingCosts + " products with erroneous packaging cost," 
          + erroneousPackagingLocationCosts + " products with erroneous packaging location cost and "
          + erroneousTotalLocCosts +" with erroneous total locations cost which have been updated."
          
          let result = {
            message: responseMessage,
            erroneousPackagingCosts: erroneousPackagingCostsNames,
            erroneousPackagingLocationCosts: erroneousPackagingLocationCostsNames,
            erroneousPackagingCosts: erroneousTotalLocCostsNames
          }

          logger.info(result)
          logger.info('Successfully completed refresh packaging costs method for products. ')
          cb(null, result)
      	})

    }], (err, docs) => {
        if(err) return done(err)
        done();
    })       

})
	

