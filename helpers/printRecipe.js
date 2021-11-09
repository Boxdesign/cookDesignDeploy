
var waterfall = require('async-waterfall');
var async = require('async');
var _ = require("underscore");
var pdf = require('html-pdf');
var cookingSteps= require ('../helpers/cookingSteps');
var allergen = require('../helpers/allergen');
var print = require('../helpers/printRecipe');
var calculateCost = require('../helpers/gastroCost');
var {ObjectId} = require('mongodb');
var Template = require('../models/template');
var Location = require('../models/location');
var Subproduct = require('../models/subproduct');
var Ingredient = require('../models/ingredient');
var Gallery = require('../models/gallery')
var Product = require('../models/product');
var Packaging = require('../models/packaging');
var Drink = require('../models/drinks');
var Dish = require('../models/dish');
var Family = require('../models/family');
var mongoose = require('../node_modules/mongoose');
var fs = require('fs');
var i18n = require('i18n');
var allergenHelper = require('../helpers/allergen')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.printRecipe;
var costHelper = require('../helpers/cost');

exports.recipe = (Model, recipeType, userLocIds, userProfile, id, templateId, simulationNetWeight, tax,  filterLocation, callback) => {
  // console.log(Model,'ModelPrint')
  var subTemplateName;
  var template;
  var recipe=[];
  var recipes=[];
  var subTemplate;
  var html;
  var cookSteps = [];
  var composition = [];
  var packaging = []
  var pricing = [];
  var compositionArray =[];
  var elementsList=[];
  var allergens = [];
  var printElement;
  var versionId;
  var compTotals = [];
  var compSubTotals = [];
  var simProcValues = [];
  var itemParent;
  var simValue=[];
  var conversionTable;

  // {
  //   grossWeight : 0,
  //   netWeight: 0,
  //   cost: 0
  // }]   

  logger.info('Entering method.')
  logger.info('filterLocation: %j',filterLocation)
  logger.info('SimulationNetWeight: %s', simulationNetWeight)
  logger.info('recipeType: %s', recipeType)
  logger.info('userLocIds: %j', userLocIds)
  logger.info('Recipe id: %j', id)

    waterfall([
      (cb) => { //Obtain recipe

          if(mongoose.Types.ObjectId.isValid(id)) {  

            Model.aggregate([
                {$match: {'_id': id}},
                {$match: {'location': {$in: userLocIds}}},
                {$unwind: {path: "$versions"}},
                {$match: {'versions.active': true}},
                {$unwind: {path: "$versions.lang"}},
                {$match: {'versions.lang.langCode': userProfile.user.language}},
               ], (err, doc) => {
                  if (err) return cb(err)
                  logger.info('Print Recipe Helper:: Obtained recipe => ' + JSON.stringify(doc));
                  printElement=doc[0];
                  versionId=doc[0].versions._id;
                  
                  Location.populate(printElement,{path:'location'},(err,doc)=>{
                    if(err) return cb(err)
                    cb(null,doc)
                  })
                                   
                })
          
          } else {
            
            var err = new Error('Invalid Object Id');
            err.statusCode=400;
            return cb(err)
          
          }

        }, (doc, cb) => { //Update unitCost of subproduct with the average location cost using filterLocation filter.

   	        costHelper.calculateAvgRecipeLocCostAndAllergens([printElement], Model);
   	        cb(null, doc)

        }, (doc, cb) => { //Update composition elements unit cost with average cost using filterLocation filter.

	        async.eachSeries(printElement.versions.composition, function(compElement, cb_async) {

	          if(compElement.element.kind == 'subproduct') { //composition element is a subproduct
	            
	            Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
	              if (err) return cb(err)

	              if(compElement.element.item != null) {

	                //Filter active version
	                let activeVersion = compElement.element.item.versions.filter((version) => {
	                  return version.active==true;
	                })

	                compElement.element.item.versions = activeVersion;

	                //Store location of subproduct
	                compElement.location = compElement.element.item.location;

	                //Update unit cost and locationCost
	                compElement.unitCost = compElement.element.item.versions[0].unitCost;
	                if(compElement.element.item.versions[0].locationCost) { 
	                  compElement.locationCost = compElement.element.item.versions[0].locationCost;
	                } else  {
	                  compElement.locationCost = [];
	                }

	                //Update composition element unitCost with average location cost based on filterLocation
	                costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, printElement.location, Subproduct);                

	                //Filter user language
	                let userLang=[];

	                userLang = compElement.element.item.versions[0].lang.filter((langItem) => {
	                  return langItem.langCode==userProfile.user.language;
	                })

	                if(userLang.length) {
	                  //The client assumes item is not populated. Must de-populate it.
	                  compElement.element.item = compElement.element.item._id;
	                  compElement.name = userLang[0].name;
	                }
	              }

	              cb_async();
	            });

	          } else { //composition element is an ingredient

	            Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
	              if (err) cb(err)

	              if(compElement.element.item != null) {

		              //Udpdate unit cost and locationCost of ingredient
		              compElement.unitCost = compElement.element.item.referencePrice;
		              if(compElement.element.item.locationCost) { 
		                compElement.locationCost = compElement.element.item.locationCost; 
		              } else {
		                compElement.locationCost = [];
		              }

		              //Update composition element unitCost with average location cost based on filterLocation
		              costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, printElement.location, Ingredient);              	

		              //Filter user language
		              let userLang=[];

		              userLang = compElement.element.item.lang.filter((langItem) => {
		                return langItem.langCode==userProfile.user.language;
		              })

		              if(userLang.length) {
		                //The client assumes item is not populated. Must de-populate it.
		                compElement.element.item = compElement.element.item._id;
		                compElement.name = userLang[0].name;
		              }
		             }

	              cb_async();
	            }); 
	          }       

	        }, (err) => { //finished async loop
	          cb(null, doc);
	        });


	      }, (doc, cb) => {//Do the same as before with packaging elements.

	      	if(recipeType == 'product') {

		        //Filter ingredient or subproduct lang field based on user language
		        async.eachSeries(printElement.versions.packaging, function(packElement, cb_async) {
		   
		          Packaging.populate(packElement, { path: "packaging" }, (err, packElement) => {
		            if (err) return cb(err)

		            if(packElement.packaging != null) {

		              //Udpdate unit cost and locationCost of subproduct
		              packElement.unitCost = packElement.packaging.referencePrice;

		              if(packElement.packaging.locationCost) { 
		                packElement.locationCost = packElement.packaging.locationCost;
		              } else  {
		                packElement.locationCost = [];
		              }

		              //Update composition element unitCost with average location cost based on filterLocation
		              costHelper.calculateCompElementAvgLocCostAndAllergens(packElement, printElement.location, Packaging); //Method also valid for packaging elements

		              //Filter user language
		              let userLang=[];

		              userLang = packElement.packaging.lang.filter((langItem) => {
		                return langItem.langCode=userProfile.user.language;
		              })

		              if(userLang.length) {
		                //The client assumes packaging is not populated. Must de-populate it.
		                packElement.packaging = packElement.packaging._id;
		                packElement.name = userLang[0].name;
		              }

		              packElement.totalCost = packElement.unitCost * packElement.numItems;
		            }

		            cb_async();
		              
		          });

		        }, (err) => { //finished async packaging loop
		          logger.info('Updated product\'s packagings elements cost')
		          cb(null, doc);
		        });

		      }
		      else
		      {
		      	cb(null, doc);
		      }

	      }, (doc, cb) => { //Get conversion table

							costHelper.getConversionTable((err, table) => {
								conversionTable = table;
								cb(null, doc);
							})

        },(doc,cb) => { //Recalculate recipe composition elements cost

						//Calculate costs of all elements using conversion table
						printElement.versions.composition.forEach((recipeElement) => {


              if(recipeElement.measuringUnit==null) { //measuring unit is an equivalence unit. Gross weight is already expressed in base unit.
                
                recipeElement.grossWeight = recipeElement.equivalenceUnit.quantity * recipeElement.quantity;
                recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;  
                recipeElement.netWeight=(recipeElement.grossWeight*(1-(recipeElement.wastePercentage/100)));

              
              } else {
              
                  //console.log('recipeElement.measuringUnit!=null')
                  let measuringUnitId = new ObjectId(recipeElement.measuringUnit);
                  let baseUnitId = new ObjectId(recipeElement.baseUnit);

                  if(!measuringUnitId.equals(baseUnitId)) { //measuring unit is different than base unit, so we need conversion factor
                    //console.log('!measuringUnitId.equals(baseUnitId)')
                    //Find conversion quantity in convertion table. Start by finding base unit...
                    conversionTable.find((x) => { 
                      let xBaseUnit = new ObjectId(x.baseUnit._id);
                      let baseUnitId = new ObjectId(recipeElement.baseUnit);
                      //console.log(xBaseUnit.equals(baseUnitId), 'xBaseUnit.equals(baseUnitId)')
                      if(xBaseUnit.equals(baseUnitId)) {

                        //console.log('x.baseUnit._id == recipeElement.baseUnit')
                        //Now find the conversion quantity in conversions object
                        x.conversions.find((c) => {
                          let convUnit = new ObjectId(c.convUnit._id);
                          //console.log(convUnit.equals(measuringUnitId), 'xBaseUnit.equals(baseUnitId)')                        
                          if(convUnit.equals(measuringUnitId)) {


                        //console.log('c.convUnit._id == recipeElement.measuringUnit')
                            let conversionQty = c.quantity;
                            recipeElement.calculatedCost = recipeElement.grossWeight * conversionQty * recipeElement.unitCost;
                            recipeElement.netWeight=recipeElement.grossWeight*(1-(recipeElement.wastePercentage/100))* conversionQty
                          }             
                        })
                      }
                    })
                  } else { //Measuring unit is equal to base unit, so there's no need for conversion
                  //console.log('measuringUnitId.equals(baseUnitId)')
                    //console.log('calculating calculatedCost: grossWeight= ' + reciperecipeElement.grossWeight+ 'unit cost: '+recipeElement.unitCost)
                    recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;
                    recipeElement.netWeight=(recipeElement.grossWeight*(1-(recipeElement.wastePercentage/100)));
                  }
              }

						})

						cb(null, doc)

        },(doc,cb) => { //Obtain list of subproducts in recipe.
            
            let subproducts=[];
            let parent = [];

            if(Model == Subproduct) parent = parent.concat(id);

            exports.getSubproductsInPrintElement(id, Model, parent, simulationNetWeight || null , printElement.location, (err, doc) => {
              
              if(err) return cb(err);
               
              elementsList=elementsList.concat(doc.elementsList);
              composition=composition.concat(doc.compositionList); //array of compositions list for each element, with quantities updated for simulation net weight.
              composition.splice(0,1) //remove first object because it's the composition of the recipe to print.
              
              logger.info('Length of elementsList and composition before removing duplicates. ElementsList: %s and composition: %s', elementsList.length, composition.length)

              let res=exports.removeDuplicates(elementsList, composition);
              elementsList = res.elementsList;
              composition = res.composition;
              
              logger.info('%j', composition)
              logger.info('Obtained list of subproducts in recipe. Total count: %s', elementsList.length)
              logger.info('Obtained list of composition list for subproducts in recipe. Total count: %s', composition.length)

              elementsList.splice(0,0,printElement); //Add actual recipe at position zero of elementsList array.
              
              cb(null,doc)   
            }) 

        }, (doc, cb) => { //Add composition list of recipe to be printed to first position of array composition. Create allergens and pricing array.

          //Add composition list of recipes included in elementsList into a composition array, composition.
          //The first element is the composition of the actual recipe and the other elements are subproducts included in the recipe.
          
          elementsList.forEach((element,index) => {
          
            if(index==0){ //actual recipe to be printed

                if(recipeType == 'dish' || recipeType == 'drink'){
                    
                  if(element.versions.composition){

                      compositionArray=element.versions.composition; 
                      let sortedComposition = exports.sortedCategory(compositionArray); 
                      composition.unshift(sortedComposition);
                      logger.info('Recipe is a dish or drink, sorted composition elements by type: main, dressing, etc.')
                  }
                
                } else {

                  logger.info('Recipe is not a dish or drink, no need to sort composition elements by type: main, dressing, etc.')
                  
                  if(element.versions.composition){
                    composition.unshift(element.versions.composition);
                  }

                }          
            } 
            
            if(element.versions.allergens){
                 allergens.push(element.versions.allergens);

                 logger.info('Pushing allergens of recipe element into allergens array.')
            }
            
            if(element.versions.pricing){
                pricing.push(element.versions.pricing);
                logger.info('Pushing pricing of recipe element into pricing array.')
            }

            if(element.versions.packaging){
                packaging.push(element.versions.packaging)
                logger.info('Pushing packaging of recipe element into packaging array.')
            }
                  
          })

          cb(null,doc)

        }, (doc, cb) => { //populate recipes in elementList array and store them into recipe array
          
          async.eachOfSeries(elementsList,function(element,index,cb_async){
            
            if(index==0) {
                
              Model.populate(element, {path: "measurementUnit family family.subfamilies versions.gallery versions.last_account versions.pricing "}, (err, doc) => {
                if (err) return cb(err)
                  //console.log(doc,'docPopulate1')
                  recipe.push(doc);
                  logger.info('Populated recipe being printed and stored it into recipe array.')
                  cb_async();
              });
            
            } else {

              Subproduct.populate(element, {path: "measurementUnit family family.subfamilies versions.gallery versions.last_account versions.pricing "}, (err, doc) => {
                  if (err) return cb(err)
                  //console.log(doc.versions,'docPopulate2')
                  recipe.push(doc);
                  logger.info('Populated subproduct included in recipe and stored it into recipe array.')
                  cb_async();
              });
            }

          },function(err){
            cb(null,doc)
          }) 

        }, (doc, cb) => { //populate allergens
          
          allergen.getAllergens(userProfile, (err, doc)=>{
            
            allergens.forEach((allergenArray) => {
              
              allergenArray.forEach((recipeAllergen) => {
                
                let subAllerId = new ObjectId(recipeAllergen.allergen);
                doc.forEach((allergen) => {                
                  let allergenId = new ObjectId(allergen._id)
                  if(subAllerId.equals(allergenId)) {
                    recipeAllergen.allergen=allergen;
                  }
                })
              })
            })
            
            logger.info('Populated allergens in allergen array')
            cb(null,doc) //console.log(doc, 'allergen')
          })   
        
        }, (doc, cb) => { //populate subfamily
          
          async.eachSeries(elementsList, (element,cb_async) => {

            if (element.subfamily !=null) {
              Family.find(
              {   
                _id: element.family
              },
              {
                category: 1,
                subfamilies: 1,
                lang: {$elemMatch: {langCode: userProfile.user.language}
              }
            }) 
              .exec((err, doc)=>{
                if (err) cb(err)

                let subFamId = new ObjectId(element.subfamily);
                
                doc[0].subfamilies.every((subfamily) => {
                  let id = new ObjectId(subfamily._id)
                  if(subFamId.equals(id)) {

                    element.subfamily=subfamily;
                    return false;

                  } else {
                    return true;
                  }
                })
                cb_async();
              }) 

            } else {
              cb_async();
            }        

          },function(err){ //Finished async loop
            logger.info('Populated subfamilies in elementsList array.')
            cb(null,doc)
          })
          
        }, (doc, cb) => { //Get cooking steps
          
          async.eachOfSeries(elementsList,function(element,index,cb_async){
            
            if(index==0){

              cookingSteps.getCookSteps(element._id,element.versions._id, Model, userProfile, (err, doc)=>{
               if (err) return cb(err);
               if(element.versions.cookingSteps){
                cookSteps.push(doc);
              }
              cb_async();   
            })

            } else {

              cookingSteps.getCookSteps(element._id,element.versions[0]._id, Subproduct, userProfile, (err, doc)=>{
               if (err) return cb(err);
               if(element.versions[0].cookingSteps){
                cookSteps.push(doc);
              }
              cb_async();   
            })
            }             
          
          },function(err){
              cb(null,doc);
          })

        }, (doc, cb) => { //Get template
          
          if(mongoose.Types.ObjectId.isValid(templateId)) {  
            
            Template.findById(templateId, (err, doc) => {
              if (err) cb(err);
              if (!doc) {
                
                var err = new Error('Document not found')
                err.statusCode = 404;
                cb(err);
              
              } else {
                
                template=doc;
                subTemplateName=template.lang[0].name;
                logger.info('Obtained template.')

                cb(null, doc); 
              }
            })
          
          } else {
            
            var err = new Error('Invalid Object Id');
            err.statusCode=400;
            cb(err)
          }
        
        },(doc,cb)=>{ //Gest subtemplate

            Template.find(
              {category: "subTemplate","lang.name" : subTemplateName}
            ).exec((err,doc)=>{
              if(err) return cb(err)
              
              subTemplate=doc;
              logger.info('Obtained subtemplate.')
              cb(null,doc)
            })

        },(doc, cb) => { 

        		//Calculate recipe composition totals
				  	printElement.versions.compositionCost=0;
				  	printElement.versions.composition.forEach((element) => {
				  		printElement.versions.compositionCost+=element.calculatedCost;
				  	})

        		if(recipeType == 'product') {

        			//Calculate packaging totals
					   	printElement.versions.packagingCost = 0;
					   	printElement.versions.packaging.forEach( (productPackage) => {
					   		printElement.versions.packagingCost+=productPackage.totalCost;
					   	})

	            printElement.versions.totalCost = printElement.versions.packagingCost + printElement.versions.compositionCost;
	          }

				   	cb(null, doc)

        },(doc, cb) => { //Calculate composition totals

        	logger.info('Calculating composition totals for %s recipes', JSON.stringify(composition.length));
          logger.info('Recipe net weight is %s', recipe[0].versions.netWeight);

          composition.forEach((comp,index) => {

            logger.info('Evaluating recipe %s in composition array.', index);

            let compTotal = {
              grossWeight:0,
              netWeight:0,
              cost:0,
              simulationGrossWeight: 0
            };

            comp.forEach((compElement,index2)=>{
            	logger.info('Evaluating composition element %s in recipe composition.', index2);

              compTotal.grossWeight+=compElement.grossWeight;
              compTotal.netWeight+=compElement.netWeight;
              compTotal.cost+=compElement.calculatedCost;
              compTotal.simulationGrossWeight+=simulationNetWeight * (compElement.grossWeight / recipe[0].versions.netWeight);            

            	logger.info('Comp element gross weight is %s', compElement.grossWeight)
            	logger.info('Comp element net weight is %s', compElement.netWeight);
            	logger.info('Comp element calculated cost is %s', compElement.calculatedCost);
            	logger.info('Comp element simulation gross weigth is %s', simulationNetWeight * (compElement.grossWeight / recipe[0].versions.netWeight));

            }) 
            
            compTotals.push(compTotal);
          })
          
          logger.info('Calculated composition totals and stored them into compTotals array: %s', JSON.stringify(compTotals));
          cb(null,doc);

        }, (doc, cb) => { 
          
          if(composition.length > 1){

            composition.forEach((comp,index)=>{
            
              if(index!=0){

                let compositionTotals = {
                  batchWeight: 0,
                  grossWeight: 0,
                  cost: 0,
                  netWeight: 0
                }
                
                comp.forEach((composition)=>{
                  compositionTotals.grossWeight+=composition.grossWeight;
                  //let netWeight = composition.grossWeight*(1-(composition.wastePercentage/100));
                  compositionTotals.batchWeight+=composition.batchWeight
                  compositionTotals.cost+=composition.calculatedCost;
                  compositionTotals.netWeight+=composition.netWeight;

                })
                compSubTotals.push(compositionTotals);
              }

            })

          }

          logger.info('Calculated composition totals of each subproduct in Recipe and stored them into compSubTotals array.')
          cb(null,true);

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
          var subCompiled = _.template(subTemplate[0].template);
          logger.info('Generated compiled template and subtemplate.')

          let date = timeStamp();
          var location=[];
          
          elementsList.shift();
          let firstComposition=composition.shift();
          let firstCookingSteps=cookSteps.shift();
          allergens=removeDuplicatesAllergens(allergens[0]);
          let firstCompTotals=compTotals.shift();
          let firstRecipe=recipe.shift();
          let firstPackaging = packaging.shift();

          i18n.setLocale(userProfile.user.language);

          html=compiled({
            allergens: allergens,
            recipe: firstRecipe, 
            cookingSteps: firstCookingSteps, 
            composition: firstComposition,
            packaging: firstPackaging,
            compTotals: firstCompTotals, 
            images: images,
            recipeType: recipeType,
            simulationNetWeight: simulationNetWeight,
            i18n: i18n,
            date: date,
            tax: tax,
            subCompiled:subCompiled({
              elementsList: elementsList,
              recipe: recipe, 
              composition: composition,
              packaging: packaging,
              images: images,
              tax:tax,
              cookingSteps: cookSteps,
              i18n: i18n,
              date: date,
              allergens: allergens,
              compTotals: compTotals,
              subTotals: compSubTotals,
              simulationNetWeight: simProcValues
            })
          });
          logger.info('Generated html from compiled template and subtemplate.')

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
           if (err) cb(err);
           logger.info('Generated pdf from html.')
           cb(null, stream)
         
         });

      }], (err, stream) => {
        //console.log(err,'error')
        if (err) return callback(err)
        callback(null, stream)
      })

}

//Function used to sort array based on name
function compare(a,b) {
  if (a.category < b.category)
    return -1;
  if (a.category > b.category)
    return 1;
  return 0;
}

function sort(aller) {
  var allElements = aller;
  var sortedElements = [];
  var filteredElements = [];
  //console.log(aller[0],'aller')
  filteredElements=allElements.filter(element => element._id);
  if(filteredElements.length >0) {
    filteredElements[0].init=true;
    for(var i=0; i < filteredElements.length; i++ ) {
      sortedElements.push(filteredElements[i]);
    }
     //console.log(filteredElements,'filteredP')
   }

   filteredElements=[];
   return aller;

}

exports.sortedCategory = (compositionArray)=>{
  logger.info('sortedCategory - Entering method')
  var allElements = compositionArray;
  var sortedElements = [];
  var filteredElements = [];

  filteredElements=allElements.filter(element => element.category == 'mainProduct');
  if(filteredElements.length >0) {
    filteredElements[0].init=true;
    logger.info('SortedCategory - setting .init=true for mainProduct')
    for(var i=0; i < filteredElements.length; i++ ) {
      sortedElements.push(filteredElements[i]);
    }
     //console.log(filteredElements,'filteredP')
   }

   filteredElements=[];

   filteredElements=allElements.filter(element => element.category == 'dressing');
   if(filteredElements.length >0) {
    filteredElements[0].init=true;
    logger.info('SortedCategory - setting .init=true for dressing')
    for(var i=0; i < filteredElements.length; i++ ) {
      sortedElements.push(filteredElements[i]);
    }
      //console.log(filteredElements,'filteredD')
    }

    filteredElements=[];

    filteredElements=allElements.filter(element => element.category == 'sauce');
    if(filteredElements.length >0) {
      filteredElements[0].init=true;
      logger.info('SortedCategory - setting .init=true for sauce')
      for(var i=0; i < filteredElements.length; i++ ) {
        sortedElements.push(filteredElements[i]);
      }
      //console.log(filteredElements,'filteredS')
    }

    filteredElements=[];

    filteredElements=allElements.filter(element => element.category == 'addition');
    if(filteredElements.length >0) {
      filteredElements[0].init=true;
      logger.info('SortedCategory - setting .init=true for addition')
      for(var i=0; i < filteredElements.length; i++ ) {
        sortedElements.push(filteredElements[i]);
      }
      //console.log(filteredElements,'filteredA')
    }
    //logger.info({sortedElements: sortedElements},'sortedCategory - return sortedElements')
    //console.log(sortedElements,'arraysort')
    return sortedElements;
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

//Method to search list of subproducts in print element
exports.getSubproductsInPrintElement = (_id, Model, parent, simulationNetWeight, filterLocation, cb) => { 
  var printElementId = new ObjectId(_id);
  let elementsList = [];
  let compositionList = [];
  var printElement;
  var compositionPrint;
  var conversionTable;
  var Subproduct = require('../models/subproduct');
	var Product = require('../models/product');
	var Drink = require('../models/drinks');
  var Dish = require('../models/dish');

  logger.info('getSubproductsInPrintElement - processing subproduct with id: %s', _id)

  waterfall([
        (cb) => { //Get active version of print element
          
          Model.aggregate([
            {$unwind:
              {path: "$versions"}
            },
            {$match: {'_id': printElementId}},
            {$match: {'versions.active': true}}
            
            ], (err, doc) => {
              
              if(err) return cb(err)
              if(Model == Subproduct) logger.info('getSubproductsInPrintElement - obtained subproduct with id: %s', doc[0]._id)
              if(Model == Product) logger.info('getSubproductsInPrintElement - obtained product with id: %s', doc[0]._id)
              if(Model == Dish) logger.info('getSubproductsInPrintElement - obtained dish with id: %s', doc[0]._id)
              if(Model == Drink) logger.info('getSubproductsInPrintElement - obtained drink with id: %s', doc[0]._id)

              cb(null, doc);
            })

      }, (doc, cb) => { //Calculate recipe average location cost

   	        	costHelper.calculateAvgRecipeLocCostAndAllergens(doc, Model, filterLocation);
   	        	logger.info('getSubproductsInPrintElement - Calculated recipe average location cost ')
   	        	cb(null, doc)

        }, (doc, cb) => { //Update recipe's composition elements unit cost with average cost using filterLocation filter.

	        async.each(doc[0].versions.composition, (compElement, cb_async) => {

	          if(compElement.element.kind == 'subproduct') { //composition element is a subproduct
	            
	            Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
	              if (err) return cb_async(err)

	              if(compElement.element.item != null) {

	                //Filter active version
	                let activeVersion = compElement.element.item.versions.filter((version) => {
	                  return version.active;
	                })

	                compElement.element.item.versions = activeVersion;
                  if(compElement.element.item.versions[0].locationCost) { 
                    compElement.locationCost = compElement.element.item.versions[0].locationCost;
                  } else  {
                    compElement.locationCost = [];
                  }
	                //Update composition element unitCost with average location cost based on filterLocation
	                costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, filterLocation, Subproduct);                

	              }

	              cb_async();
	            });

	          } else { //composition element is an ingredient

	            Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
	              if (err) return cb_async(err)
                  console.log(compElement, 'compElement')
	              if(compElement.element.item != null) {
                  if(compElement.element.item.locationCost) { 
                    compElement.locationCost = compElement.element.item.locationCost;
                  } else  {
                    compElement.locationCost = [];
                  }

		              //Update composition element unitCost with average location cost based on filterLocation
		              costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, filterLocation, Ingredient);              	

		             }

	              cb_async();
	            }); 
	          }       

	        }, (err) => { //finished async loop
	        	if(err) return cb(err)
	        	logger.info('getSubproductsInPrintElement - Finished updating recipe\'s composition elements unit cost with average cost using filterLocation filter')
	          cb(null, doc);
	        });

	      }, (doc, cb) => { //Get conversion table

							costHelper.getConversionTable((err, table) => {
								conversionTable = table;
								cb(null, doc);
							})

        },(doc,cb) => { //Recalculate recipe composition elements cost

						//Calculate costs of all elements using conversion table
						doc[0].versions.composition.forEach((recipeElement) => {

              if(recipeElement.measuringUnit==null) { //measuring unit is an equivalence unit. Gross weight is already expressed in base unit.
               
                recipeElement.grossWeight = recipeElement.equivalenceUnit.quantity * recipeElement.quantity;
                recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;  
                recipeElement.netWeight=(recipeElement.grossWeight*(1-(recipeElement.wastePercentage/100)));

              
              } else {
              
                  //console.log('recipeElement.measuringUnit!=null')
                  let measuringUnitId = new ObjectId(recipeElement.measuringUnit);
                  let baseUnitId = new ObjectId(recipeElement.baseUnit);

                  if(!measuringUnitId.equals(baseUnitId)) { //measuring unit is different than base unit, so we need conversion factor
                    //console.log('!measuringUnitId.equals(baseUnitId)')
                    //Find conversion quantity in convertion table. Start by finding base unit...
                    conversionTable.find((x) => { 
                      let xBaseUnit = new ObjectId(x.baseUnit._id);
                      let baseUnitId = new ObjectId(recipeElement.baseUnit);
                      //console.log(xBaseUnit.equals(baseUnitId), 'xBaseUnit.equals(baseUnitId)')
                      if(xBaseUnit.equals(baseUnitId)) {

                        //console.log('x.baseUnit._id == recipeElement.baseUnit')
                        //Now find the conversion quantity in conversions object
                        x.conversions.find((c) => {
                          let convUnit = new ObjectId(c.convUnit._id);
                          //console.log(convUnit.equals(measuringUnitId), 'xBaseUnit.equals(baseUnitId)')                        
                          if(convUnit.equals(measuringUnitId)) {


                        //console.log('c.convUnit._id == recipeElement.measuringUnit')
                            let conversionQty = c.quantity;
                            recipeElement.calculatedCost = recipeElement.grossWeight * conversionQty * recipeElement.unitCost;
                            recipeElement.netWeight=recipeElement.grossWeight*(1-(recipeElement.wastePercentage/100))* conversionQty
                          }             
                        })
                      }
                    })
                  } else { //Measuring unit is equal to base unit, so there's no need for conversion
                  //console.log('measuringUnitId.equals(baseUnitId)')
  					  			//console.log('calculating calculatedCost: grossWeight= ' + reciperecipeElement.grossWeight+ 'unit cost: '+recipeElement.unitCost)
  					  			recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;
                    recipeElement.netWeight=(recipeElement.grossWeight*(1-(recipeElement.wastePercentage/100)));
  				  			}
				  		}

						})

						cb(null, doc)

      }, (doc, cb) => { //Calculate composition quantities for simulationNetWeight
          
        if(simulationNetWeight) {

          doc[0].versions.composition.forEach((compElement) => {

            switch(Model) {

              case Dish:
              case Drink: 
                compElement.batchWeight = compElement.grossWeight * simulationNetWeight;
              break;

              case Subproduct:
              case Product:
                compElement.batchWeight = (compElement.grossWeight/doc[0].versions.netWeight) * simulationNetWeight;
                //console.log(compElement.batchWeight, 'compElement.batchWeight')
              break;
            }

          })
           //logger.info('getSubproductsInPrintElement - Calculated composition quantities for simulationNetWeight and stored them in composition array')
        }
        compositionList.push(doc[0].versions.composition);
       
        cb(null, doc)

      }, (doc, cb) => { //Update unitCost of subproduct with the average location cost using filterLocation filter.

        costHelper.calculateAvgRecipeLocCostAndAllergens(doc, Subproduct, filterLocation);

        cb(null, doc)        

      }, (doc, cb) => {

          async.eachSeries(doc[0].versions.composition, function(compElement, cb_async) {

            if(compElement.element.kind == 'subproduct' && compElement.element.item!=null) {

              let subproductId = new ObjectId(compElement.element.item._id)

              //console.log(parent, 'parent')
              
              let match = parent.some((_id) => {
                let id = new ObjectId(_id);
                return id.equals(subproductId)
              })

              if(match) {
                  logger.error('getSubproductsInPrintElement - Circular loop detected when obtaining subproducts in recipe.')
                  process.nextTick(()=>cb_async()); 

              } else {

              	if(compElement.element.item) {

                  parent.push(compElement.element.item._id);                

                  elementsList.push(compElement.element.item);

                //console.log(compElement.element.item, 'getSubproductsInPrintElement - compElement.element.item')

                  exports.getSubproductsInPrintElement(compElement.element.item._id, Subproduct, parent, compElement.batchWeight || null, filterLocation, (err, res) => { //recursive call!!!
                    parent.pop()
                    if(res.elementsList.length > 0) elementsList = elementsList.concat(res.elementsList);
                    if(res.compositionList.length > 0) compositionList = compositionList.concat(res.compositionList);

                    process.nextTick(()=>cb_async());

                    });
                } else {
                	logger.warn("The value of a composition item is null. Skipping. id: %s", doc[0]._id, " ,version: %s", doc[0].versions._id)
                	process.nextTick(()=>cb_async()); 
                }

               } 

            } else {
                process.nextTick(()=>cb_async());                                    
            } 
          
          }, (err, results) => {
                cb(null, elementsList);
          })

        }], (err, elementsList) => {
          if (err) return cb(err)
          
          let res = {
            elementsList: elementsList,
            compositionList: compositionList
          }
          
          cb(null, res)
        }) 
}


exports.removeDuplicates = (arr, arr2)=>{
  // console.log(arr,'arr')
  // console.log(arr.length,'arr2')
  let duplicateIndexes = [];

  var i,j,cur,found;
  for(i=arr.length-1;i>=0;i--){
    cur = new ObjectId(arr[i]._id);
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= new ObjectId(arr[j]._id);
      if(cur.equals(id)){
        if(i!=j){
        	duplicateIndexes.push(i)
          arr.splice(i,1);
          arr2.splice(i,1);
        }
        found=true;
      }
    }
  }
  return {elementsList: arr, composition: arr2}
}

var removeDuplicatesAllergens = (arr)=>{
  
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
      //console.log(cur,'not match with id',id)
    }
  }
  // console.log(arr.length,'arrayRemoveDuplicates.length')
  // console.log(arr,'arrayRemoveDuplicates')
  return arr;
}