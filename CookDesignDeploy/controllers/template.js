var Template = require('../models/template');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');
var mongoose = require('../node_modules/mongoose');

/**
 * @api {post} /template Add new template
 * @apiGroup {template}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Template-Creation:
 {
    "lang": [{
        "langCode": "es",
        "name": "Descriptiva"
    }],
    "category": "gastroOffer",
    "template" : "<p>hello</p>"
 }
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 **/ 

 exports.add = (req, res) => {

 	var inTemplate=req.body;

 	var template= new Template(inTemplate);
 	template.save((err, doc) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc).end();  
    });

};


/**
 * @api {get} /template Get templates within category and subcategory
 * @apiGroup {template}
 * @apiName Get Templates
 *
 * @apiDescription Get templates within category and subcategory
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _category  template category
 * @apiParam {string} _subcategory  template subcategory
 *
 * @apiSuccess {Object} Template list
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getTemplates=(req,res)=>{
    let params = req.query;
    var categoryPipe = {};
    let userProfile = req.userData;

     waterfall([
        (cb) => { 

            if((params._category && params._category!='')&&(params._subcategory && params._subcategory!='')) 
                categoryPipe = {'category' : params._category, 'subCategory' : params._subcategory};
            else if(params._category && params._category!='')
                categoryPipe = {'category' : params._category};
            else categoryPipe = {'subCategory' : params._subcategory};

            cb(null, true);

        }, (doc, cb) => {

            Template.find(
                categoryPipe,
                {   
                    template: 1,
                    category: 1,
                    subCategory: 1,
                    templateCode:1,
                    lang: {$elemMatch: {langCode: userProfile.user.language}}
                }
            )
            .sort({ 'orderList': 1 })
            .exec((err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }else {
                    cb(null, doc);
                }
            })

    }], (err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
    })

 }

  //Function used to sort array based on name
function compare(a,b) {
  if (a.name < b.name)
  return -1;
  if (a.name > b.name)
      return 1;
  return 0;
}


/**
 * @api {delete} /template Delete template
 * @apiGroup {template}
 * @apiName Delete Template
 *
 * @apiDescription Delete a template
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  template id
 *
 * @apiSuccess {Object} Template removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.remove=(req,res)=>{
 	let params = req.query;
 	var templateId = new ObjectId(params._id);

 	 waterfall([
        (cb) => { //location check. Verify that at least one user location is within the subproduct's locations      

        	if(mongoose.Types.ObjectId.isValid(params._id)) {  
            	Template.findById(templateId, (err, doc) => {
	            		console.log(doc,'doc');
	                if (err) cb(err);
	                if (!doc) {
	                    var err = new Error('Document not found')
	                    err.statusCode = 404;
	                    return cb(err);
	                }else {

	                cb(null, doc);
	            	}
	            })
            
            } else {
	            var err = new Error('Invalid Object Id');
	            err.statusCode=400;
	            return cb(err)
	        }
        }, (doc, cb) => {
        		//remove template
        		doc.remove(function (err, doc) {
            		if (err) return cb(err)
            			cb(null, doc);
         		});
    }], (err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
    })

 }

 /**
 * @api {update} /template/update Update template
 * @apiGroup {template}
 * @apiName Update Template
 *
 * @apiDescription Update a template
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  template id
 *
 * @apiSuccess {Object} Template updated
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.updateTemplate =(req,res)=> {
 		
 		var updateTemplate=req.body;

 		//var templateId=new ObjectId(params._id);
		waterfall([
			(cb)=>{
				Template.findOne({'_id': updateTemplate._id}, '', (err, doc) => {
                if (err)
                    return cb(err)
                if (!doc)
                    return res.status(400).json(doc).end();
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb, doc);
                cb(null, doc)
            })
        }, (doc, cb) => {
					updateTemplate.template=updateTemplate;
					Template.update({_id: updateTemplate._id}, updateTemplate, (err,doc) => {
           			 if (err) return cb(err)
           			 cb(null,doc);
        		})
          }
        ],(err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
    })
}