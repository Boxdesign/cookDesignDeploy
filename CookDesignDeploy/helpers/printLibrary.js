var fs = require('fs');

exports.printLibrary = (type, familyType, userLocIds, userProfile, templateId,  user, filterFamily, format, callback) => {
	var waterfall = require('async-waterfall');
  var loggerHelper = require('../helpers/logger');
  const logger = loggerHelper.printLibrary;
	var async = require('async');
	var _ = require("underscore");
	var pdf = require('html-pdf');
	var cookingSteps= require ('../helpers/cookingSteps');
	var calculateCost = require('../helpers/gastroCost');
	var {ObjectId} = require('mongodb');
	var Template = require('../models/template');
	var Location = require('../models/location');
	var Family = require('../models/family');
	var Allergen = require('../models/allergen');
	var CheckPoint = require('../models/checkpoint');
	var MeasurementUnit = require('../models/measurementUnit');
	var PackFormat = require('../models/packFormat');
	var Process = require('../models/process');
	var Utensil = require('../models/utensil');
	var mongoose = require('../node_modules/mongoose');
	var fs = require('fs');
	var i18n = require('i18n');
	var allergenHelper = require('../helpers/allergen');
	//console.log('printLibraryHelper!!')
	var subTemplateName;
  var template;
  var library=[];
  var checkpoints=[];
  var subTemplate;
  var html;
  var Model;
  var measurementUnits = [];
  var packFormats = [];
  var processes =[];
  var elementsList=[];
  var allergens = [];
  var utensils = [];
  var families = [];
  var familyType;
  var user;

  console.log(templateId, 'template')
  

	waterfall([

		(cb)=>{

			switch(type.toString()){

				case 'allergen': 

							allergenHelper.getAllergens(userProfile, (err, aller) => {
						      if(err) return cb(err)
						      allergens = aller;
						    	library = allergens;
						      logger.info('Print Library - Got list of allergens.')
						      cb(null, true)
						  })

						  break;

				case 'checkpoint':

							CheckPoint.find({},{
								lang:1,
								type:1,
								referenceNumber:1,
								assigned_location:1,
								last_account:1
							})
							.populate('assigned_location last_account')
							.exec((err,docs)=>{
								if (err) return cb(err)
									checkpoints = docs;
									library = sortCheckPoints(checkpoints);
						      logger.info('Print Library - Got list of Checkpoints.')
						      cb(null,true)
							})

							break;

				case 'measurementUnit': 

							MeasurementUnit.find({}, {
	                last_account: 1,
	                updatedAt: 1,
	                referenceCode:1,
	                parentUnits: 1,
	                base: 1,
	                lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
	            })
                .populate('parentUnits.unit last_account')
                .exec((err, docs) => {

          				if (err) return cb(err)

                  if (docs && docs.length) {
                      measurementUnits = docs
                      library = measurementUnits
								      logger.info('Print Library - Got list of Measurement Units.')
                  } 
                	cb(null,true)
                })

                break;

          case 'packFormat':

          			PackFormat.find({}, {
		                last_account: 1,
		                updatedAt: 1,
		                referenceNumber:1,
		                gallery: 1,
		                lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
		            })
                .populate('assigned_location last_account gallery')
                .exec((err, docs) => {

                  if (err) return cb(err)

                  if (docs && docs.length) {
                      packFormats = docs
                      library = packFormats
								      logger.info('Print Library - Got list of PackFormats.')
								      
                  } else {
                  	library = []
                  }
                  cb(null,true)
                })

                break;

          case 'process': 

          			Process.find({},{

		                last_account: 1,
		                updatedAt: 1,
		                referenceNumber:1,
		                parentUnits: 1,
		                videos: 1,
		                images: 1,
		                lang: {$elemMatch: {langCode: userProfile.user.language}} //@TODO elemMatch on populated array
		            })
                .sort("lang.name")
                .populate('assigned_location last_account images')
                .exec((err, docs) => {

                  if (err) return cb(err)

                  if (docs && docs.length) {
                      processes = docs
                      library = processes
								      logger.info('Print Library - Got list of Processes.')
                  } 
                  cb(null,true)
                })

                break;

          case 'utensil': 

          			Utensil.find({}, {

		                last_account: 1,
		                updatedAt: 1,
		                parentUnits: 1,
		                referenceNumber:1,
		                base: 1,
		                gallery: 1,
		                family: 1,
		                subfamily: 1,
                    externalFamily:1,
		                lang: {$elemMatch: {langCode: userProfile.user.language}} //@TODO elemMatch on populated array
		            })
                .populate('assigned_location family family.subfamilies last_account gallery')
                .exec((err, docs) => {

                    if (err) return cb(err)

                    if (docs && docs.length) {
                        utensils = docs
                        library = utensils
									      logger.info('Print Library - Got list of Utensils.')
                    } 
	                  cb(null, true)
            		})
          
          		break;

          case 'family':

          		Family.find({},{
          			lang:1,
          			category:1,
          			referenceNumber:1,
          			subfamilies:1,
          			last_account:1,
          			assigned_location:1
          		})
          		.populate('assigned_location last_account')
              .exec((err, docs) => {

                if (err) return cb(err)

                if (docs && docs.length) {
                    families = docs
                    library = families.filter((family)=>{
                    	return family.category == familyType
                    })
							      logger.info('Print Library - Got list of Families.') 
                } 
                cb(null,true)
          		})


          		break;

          default:
          			break;

			}
			

		},(doc,cb)=>{

			if(mongoose.Types.ObjectId.isValid(templateId)) { 

        Template.findById(templateId, (err, doc) => {

          if (err) return cb(err);

          if (!doc) {

            var err = new Error('Document not found')
            err.statusCode = 404;
            return cb(err);

          } else {

            template=doc;
            cb(null, doc); 
          }

        })

      } else {

        var err = new Error('Invalid Object Id');
        err.statusCode=400;
        return cb(err)
      }

    },(doc,cb) => {

      if(format == '.csv'){

      }
      cb(null,doc)
      
		},(doc,cb)=>{


      if(format == '.pdf'){

        let base64ImgPlaceholder = base64_encode('./templates/assets/img/img_placeholder_food.png');
        let base64ImgTexture = base64_encode('./templates/assets/img/texture.png');
        let base64ImgCircle = base64_encode('./templates/assets/img/noImageCircle.png');
        let base64logoGreen = base64_encode('./templates/assets/img/logo_green.png');
        let images = {
          imgPlaceholder: 'data:image/png;base64,' + base64ImgPlaceholder,                    
          imgTexture: 'data:image/png;base64,' + base64ImgTexture,
          imgCircle: 'data:image/png;base64,' + base64ImgCircle,
          imgLogo: 'data:image/jpg;base64,' + base64logoGreen
        }
        var compiled = _.template(template.template);

        let date = timeStamp();

        var location=[];

        i18n.setLocale(userProfile.user.language);

        html=compiled({
          library: library,
          type: type,
          images: images,
          i18n: i18n,
          date: date,
          familyType: familyType,
          user:user
        });
         
         cb(null,true);

      } else {

        var fields = ['name'];
        var fieldNames = ['Nombre ingrediente'];

        json2csv({ data: ingredientList, fields: fields, fieldNames: fieldNames }, (err, csv) => {
          
          if (err) return cb(err);
          
          fs.writeFile('/tmp/reportGastroIngredients.csv', csv, (err) => {
            if (err) return cb(err);
            cb(null, docs)
          });       
        });

      }
			

		},(doc,cb)=>{

			var options = {
        "border": {
          "top": "2mm",     // default is 0, units: mm, cm, in, px 
          "right": "15mm",
          "bottom": "0.5in",
          "left": "15mm"
        },
        "format": "A4",
        "orientation": "portrait",
        "header": {
            "height": "15mm"
        },
       "footer": {
        "height": "5mm"
          // "contents": {
          //   default: '<span class="pull-right"><span style="color: #333333; font-family: Lato;">{{page}}</span>/<span>{{pages}}</span></span>' // fallback value 
          // }
        }
      }

      pdf.create(html, options).toStream(function(err, stream){
         if (err) return cb(err);
         //console.log(err,'error')
         cb(null, stream)
      });

		}],(err,stream)=>{

			if (err) return callback(err)
      callback(null, stream)

		})

}


  exports.download = (uri, filename, callback) => {
    request.head(uri, function(err, res, body){
      request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
  };

  var base64_encode = (file) => {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
  }

  function timeStamp() {
    // Create a date object with the current time
    var now = new Date();

    // Create an array with the current month, day and time
    var date = [ now.getDate(), now.getMonth() + 1, now.getFullYear() ];

    // Create an array with the current hour, minute and second
    var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];

    // Determine AM or PM suffix based on the hour
    var suffix = ( time[0] < 12 ) ? "AM" : "PM";

    // Convert hour from military time
    time[0] = ( time[0] < 12 ) ? time[0] : time[0] - 12;

    // If hour is 0, set it to 12
    time[0] = time[0] || 12;

    // If seconds and minutes are less than 10, add a zero
    for ( var i = 1; i < 3; i++ ) {
      if ( time[i] < 10 ) {
        time[i] = "0" + time[i];
      }
    }

    // Return the formatted string
    return date.join("/") + " " + time.join(":") + " " + suffix;
  }

  var sortCheckPoints = (checkpoints)=> {
    //console.log(checkpoints,'checkpoints at begin of function')
    var checkpointArray = [];
    var check;
    var checks;

    checks = checkpoints.map((checkpoint)=>{

      let object = {
        _id : checkpoint._id,
        type : checkpoint.type,
        last_account : checkpoint.last_account,
        referenceNumber: checkpoint.referenceNumber,
        lang : checkpoint.lang,
        assigned_location: checkpoint.assigned_location,
        init : false
      }

      return object;
    })
    //console.log(checks,'checkpointsAfterMAP')
    let critical = checks.filter((checkpoint)=>{
      return checkpoint.type == 'critical';
    })
    //console.log(critical,'critical')
    if(critical && critical.length){
      checkpointArray = critical;
    }

    let gastronomic = checks.filter((checkpoint)=>{
      return checkpoint.type == 'gastronomic';
    })
    //console.log(gastronomic,'gastronomic')
    if((critical && critical.length) || (gastronomic && gastronomic.length)){

      if(critical.length == 0){
        gastronomic[0].init = true;
        check = gastronomic;
        //console.log(check,'gastronomic (critical == 0)')
      } else if(gastronomic.length == 0){
        critical[0].init = true;
        check = critical;
        //console.log(check,'critical (gastronomic == 0)')

      } else {
        gastronomic[0].init = true;
        critical[0].init = true;
        check = critical.concat(gastronomic);
        //console.log(check,'both')

      }

      checkpointArray = check ;

    }
    //console.log(checkpointArray,'checkpointArray')
    return checkpointArray;
  }