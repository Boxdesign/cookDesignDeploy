var waterfall = require('async-waterfall');
var async = require('async');
var _ = require("underscore");
var pdf = require('html-pdf');
var cookingSteps= require ('../helpers/cookingSteps');
var Allergen = require('../helpers/allergen');
var print = require('../helpers/printRecipe');
var calculateCost = require('../helpers/gastroCost');
var {ObjectId} = require('mongodb');
var Template = require('../models/template');
var Location = require('../models/location');
var Subproduct = require('../models/subproduct');
var Product = require('../models/product');
var Drink = require('../models/drinks');
var Dish = require('../models/dish');
var Family = require('../models/family');
var mongoose = require('../node_modules/mongoose');
var fs = require('fs');
var i18n = require('i18n');
var allergenHelper = require('../helpers/allergen')
var costHelper = require('../helpers/cost'); 
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.printArticles;

exports.article = (Model, articleType, userLocIds, userProfile, id, templateId, tax,  filterLocation, callback) => {
  var subTemplateName;
  var template;
  var article=[];
  var articles=[];
  var subTemplate;
  var html;
  var cookSteps = [];
  var composition = [];
  var compositionArray =[];
  var elementsList=[];
  var allergens = [];
  var printElement;
  var versionId;
  var compTotals = [];
  var simProcValues = [];
  var itemParent;
  var simValue=[];
  
  logger.info('Print article - Entering method.')
  //console.log('Print article - Entering method.')

    waterfall([
      (cb) => { //Obtain recipe

          if(mongoose.Types.ObjectId.isValid(id)) {  
            
            Model.findById(id, (err, doc) => {
              if (err) return cb(err);
              if (!doc) {
                
                var err = new Error('Document not found')
                err.statusCode = 404;
                cb(err);
              
              } else {
                logger.info('Print article - Obtained printElement.')
                cb(null, doc); 
              }
            })
          
          } else {
            
            var err = new Error('Invalid Ingredient or Packaging Object Id');
            err.statusCode=400;
            return cb(err)
          }


      }, (doc, cb) => { //populate article 

        if(articleType == 'ingredient'){

          Model.populate(doc,{path:"gallery family last_account measurementUnit locationCost allergens price"},(err,doc)=>{
            if(err) return cb(err)
              printElement=JSON.parse(JSON.stringify(doc));
              allergens=doc.allergens;
              cb(null,doc)
          })

        } else {

          Model.populate(doc,{path:"gallery family last_account measurementUnit locationCost price"},(err,doc)=>{
            if(err) return cb(err)
              printElement=JSON.parse(JSON.stringify(doc));
              //allergens=doc.allergens;
              cb(null,doc)
          })

        }
        


      }, (doc, cb) => { //If filter location is provided, updated referenceCost with 

          //If the article has a price for filterLocation location, replace the referencePrice field with the average location-based price
          if(filterLocation.length) costHelper.calculateAvgArticleLocCostAndAllergens([printElement], filterLocation) 
          cb(null, doc)

      }, (doc, cb) => { //populate allergens
          
          if(articleType == 'ingredient'){
            Allergen.getAllergens(userProfile, (err, aller)=>{


                allergens.forEach((ingredientAllergen) => {
                
                  let ingAllerId = new ObjectId(ingredientAllergen.allergen);

                  aller.forEach((allergen) => {      

                      let allergenId = new ObjectId(allergen._id)
                      if(ingAllerId.equals(allergenId)) ingredientAllergen.allergen=allergen;

                  })
                })

              
            
              logger.info('Print article - Populated allergens in allergen array')
              cb(null,doc) //console.log(doc, 'allergen')
            })   
          } else {
            logger.info('Print article - Not necessary to populate allergens, articleType')
            cb(null,doc);
          }
        
      }, (doc, cb) => { //populate subfamily
          if (doc.subfamily !=null) {

            Family.findOne(
              {   
                _id: doc.family._id
              }) 
            .exec((err, family)=>{
              if (err) return cb(err)
              let subFamId = new ObjectId(doc.subfamily);

              family.subfamilies.forEach((subfam) => {
                let id = new ObjectId(subfam._id)                

                if(subFamId.equals(id)) {
                  printElement.subfamily=subfam;
                }                  
              })
              cb(null,doc)
            }) 

          } else {
           cb(null,doc)
          }        
        
      }, (doc, cb) => { //Get template
          
          if(mongoose.Types.ObjectId.isValid(templateId)) {  
            
            Template.findById(templateId, (err, doc) => {
              if (err) return cb(err);
              if (!doc) {
                
                var err = new Error('Document not found')
                err.statusCode = 404;
                return cb(err);
              
              } else {
                
                template=doc;
                //subTemplateName=template.lang[0].name;
                logger.info('Print article - Obtained template.')

                cb(null, doc); 
              }
            })
          
          } else {
            
            var err = new Error('Invalid Template Object Id');
            err.statusCode=400;
            return cb(err)
          }
        
        }, (doc, cb) => { //Fill out template and generate html
        
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

	        logger.info('Print article - Generated compiled template.')

	        let date = timeStamp();
	        var location=[];
	        let article=printElement;
          console.log('article-->',article);
	        // if(allergens && allergens.length>2) allergens=removeDuplicatesAllergens(allergens[0]);
         //  else allergens = []

         i18n.setLocale(userProfile.user.language);

	        html=compiled({
	          allergens: allergens,
	          article: article,  
	          images: images,
	          articleType: articleType,
	          i18n: i18n,
	          date: date,
	          tax: tax
	        });
	        logger.info('Print article - Generated html from compiled template and subtemplate.')

	        cb(null,doc);        

      }, (doc, cb) => { //convert html to pdf

          var options = {
            "border": {
              "top": "2mm", // default is 0, units: mm, cm, in, px 
              "right": "15mm",
              "bottom": "0.5in",
              "left": "15mm"
            },
            "format": "A4",
            "orientation": "portrait",
            "header": {
              "height": "2mm"
            },
            "footer": {
              "height": "5mm"
            }
          }

          pdf.create(html, options).toStream(function(err, stream){
           if (err) return cb(err);
           logger.info('Print recipe - Generated pdf from html.')
           cb(null, stream)
         
         });

      }], (err, stream) => {
        //console.log(err,'error')
        if (err) {
          logger.error('Print Article --- Error: %j',err)
          return callback(err)
        }
        callback(null, stream)
      })

}

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

var removeDuplicatesAllergens = (arr) => {
  
  var i,j,cur,curLvl,found;
  for(i=arr.length-1;i>=0;i--){
    //console.log(arr[i],'arr[i]')
    cur = new ObjectId(arr[i].allergen._id);
    curLvl = arr[i].level;
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= new ObjectId(arr[j].allergen._id);
      //console.log(arr[j],'arr[j]')
      let idLvl = arr[j].level;
      if(cur.equals(id)){
        //console.log(cur,'matchIds',id)
        if(i!=j && curLvl==idLvl){
          //console.log('same Level')
          arr.splice(i,1);
        } else if(i!=j && curLvl!=idLvl){
          if(curLvl<idLvl){
            //console.log('j>i')
            arr.splice(i,1);
          } else {
            //console.log('j<i')
            arr.splice(j,1);
          }
        }
        found=true;
      }
    }
  }
  return arr;
}