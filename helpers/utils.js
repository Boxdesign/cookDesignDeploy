 
var async = require('async');
var waterfall = require('async-waterfall');
var config = require('../config/config');
var {ObjectId} = require('mongodb')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.utils;

 /* ------------------------------------CHECK RECURSIVE LOOP IN SUBPRODUCT ----------------------------------------------------------*/

exports.checkRecursiveLoopInSubproduct = (_id, parent, callback) => {

  var elementId = new ObjectId(_id);
	var Subproduct = require('../models/subproduct')

  async.waterfall([
    
    (cb) => { //Get active version of Subproduct

    	Subproduct.findOne(
    	{
    		'_id': elementId
    	},
    	{
    		versions : {$elemMatch: {active: true}},
    		_id: true 
    	}
    	).exec((err, doc) => {

          if(err) return cb(err)

          if(doc) {          
          	cb(null, doc);
          } else {
          	let err = new Error('Document not found')
          	return cb(err)
          }
    	})

    }, (doc, cb) => {

    		if(doc.versions[0]) {

	        async.eachSeries(doc.versions[0].composition, (compElement, cb_async) => {
	          //console.log(compElement,'eachSeries')
	          if(compElement.element.kind == 'subproduct'){

	              let subproductId = new ObjectId(compElement.element.item)

	              let match = parent.some((_id) => {
	                let id = new ObjectId(_id);
	                return id.equals(subproductId)
	              })  

	              if(match) {
	                logger.warn('Circular loop detected when obtaining subproducts in recipe.')
	                let err = new Error('Circular loop detected when obtaining subproducts in subproduct with id ' + _id)
	                process.nextTick(()=>cb_async(err)); 

	              } else {

	              	if(compElement.element.item) {

	              		parent.push(compElement.element.item);

		                exports.checkRecursiveLoopInSubproduct(compElement.element.item, parent, (err, res) => { //recursive call!!!
		                  if(err) return process.nextTick(()=>cb_async(err))
	                    parent.pop()
		                  process.nextTick(()=>cb_async())
		                });

		               } else {
	              			logger.warn("The value of a composition item is null. Skipping. id: " + doc._id + " ,version: " + doc.versions[0]._id)
			                process.nextTick(()=>cb_async())
		               }
	              }
	          
	          } else {
	            process.nextTick(()=>cb_async());                                    
	          } 
	        
	        }, (err, results) => { //end of async loop
	        		if(err) return cb(err)
	            cb(null, true);
	        }) 

	      }
	      else
	      {
	      	let err = new Error('Subproduct with id ' + doc._id + ' does not have active version')
	      	return cb(err)
	      }

      }], (err, doc) => { //end of waterfall
        
				if(err) return callback(err)
        callback(null, true)
    }) 
}


/* -------------------------------------REMOVE DUPLICATES---------------------------------------------------------*/

exports.removeDuplicates = (arr) => {
  //console.log(arr,'arr')
  // console.log(arr.length,'arr2')
  var i,j,cur,found;
  for(i=arr.length-1;i>=0;i--){
    cur = new ObjectId(arr[i]._id);
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= new ObjectId(arr[j]._id);
      if(cur.equals(id)){
        if(i!=j){
          arr.splice(i,1);
        }
        found=true;
      }
    }
  }
  return arr;
}

