var waterfall = require('async-waterfall');
var async = require('async');
var _ = require("underscore");
var pdf = require('html-pdf');
var cookingSteps= require ('../helpers/cookingSteps');
// var print = require('../helpers/print');
var calculateCost = require('../helpers/gastroCost');
var {ObjectId} = require('mongodb');
var Template = require('../models/template');
var Location = require('../models/location');
var Subproduct = require('../models/subproduct');
var Ingredient = require('../models/ingredient');
var Product = require('../models/product');
var Drink = require('../models/drinks');
var Dish = require('../models/dish');
var Family = require('../models/family');
var mongoose = require('../node_modules/mongoose');
var fs = require('fs');
var i18n = require('i18n');
var allergenHelper = require('../helpers/allergen')
var costHelper = require('../helpers/cost');
var gastroCostHelper = require('../helpers/gastroCost');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.printAllergen;


exports.printAllergensOfGastroOffer = (Model, userLocIds, userProfile, id, templateId, callback) => {
  //console.log(menuType,'menuTypePrintHelper')
  var subTemplateName;
  var template;
  // var recipe=[];
  // var recipes=[];
  var subTemplate;
  var html;
  var cookSteps = [];
  var composition = [];
  var pricing = [];
  var compositionArray =[];
  var elementsList=[];
  var allergens = [];
  var allergensComp = [];
  var allergensList = [];
  var aller=[];
  var gastroOffer;
  var versionId;
  var compTotals = [];
  var simProcValues = [];
  var itemParent;
  var simValue=[];
  var numFamilies;
  var totalCost;
  var allergens;
  var allergenTextList = ''; 
  var totalMeanCost=[]; 
  var fams=[];
  let gastroOfferLocation;

  // {
  //   grossWeight : 0,
  //   netWeight: 0,
  //   cost: 0
  // }]   

    waterfall([
      (cb) => {
        // let elementsList=[];
        
        if(mongoose.Types.ObjectId.isValid(id)) {   //Get active version of gastro offer

          Model.aggregate([
            {$unwind:
              {path: "$versions"}},
              {$match: {'_id': id}},
              {$match: {'versions.lang.langCode': userProfile.user.language}},
              {$match: {'versions.active': true}}
              ], (err, doc) => {
                if (err) return cb(err)
                  //console.log(doc[0],'doc')
                  gastroOfferLocation=doc[0].location;
                  versionId=doc[0].versions._id;
                  logger.info('Gastro Offer Print - Obtained active versions of gastro offer.')

                  cb(null,doc)
              })
        } else {
          var err = new Error('Invalid Object Id');
          err.statusCode=400;
          cb(err)
        }

      }, (doc, cb) => { //populate gastroOffer

        Model.populate(doc[0],{path:"location versions.type versions.season versions.last_account versions.composition.family"},(err,doc)=>{
            if (err) return cb(err)
            gastroOffer=doc;

            logger.info('Gastro Offer Print - Pupulated gastro offer.')
            cb(null,doc)
        }) 

      }, (doc, cb) => {  //Populate families and subfamilies in gastro composition list

        Family.aggregate([
            {$unwind: "$lang"},
            {
                $unwind: {
                    path: "$subfamilies",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: "$subfamilies.lang",
                    preserveNullAndEmptyArrays: true
                }
            },
            {$match: {$or: [{'subfamilies.lang.langCode': userProfile.user.language}, {'subfamilies.lang.langCode': null}]}},
            {$match: {'lang.langCode': userProfile.user.language}},
            {$match: {'category': 'gastroOffering'}},
            {
                $group: {
                    "_id": "$_id",
                    "lang": {$first: "$lang"},
                    "category": {$first: "$category"},
                    "subfamilies": {$push: '$subfamilies'},
                }
            },
          ], (err, families) => { //Populate families

            if(err) return cb(err)          

            gastroOffer.versions.composition.forEach((compElement) => { 

              families.forEach((fam, index) => {
                fams.push(fam);
                let famId = new ObjectId(fam._id)
                let elementFamId = compElement.family
                if (famId.equals(elementFamId._id)){
                  compElement.family = fam;
                  //console.log(fam,'fam')
                  families[index].subfamilies.forEach((subfam)=> {
                    //console.log(subfam,'subfam')
                    let subfamId = new ObjectId(subfam._id)
                    let elementSubFamId = null;
                    if(mongoose.Types.ObjectId.isValid(compElement.subfamily))
                      elementSubFamId = new ObjectId(compElement.subfamily)
                    if (subfamId.equals(elementSubFamId)) compElement.subfamily=subfam;
                  })
                } 
                // console.log(famId,'famId')
                // console.log(elementFamId,'elementFamId')
              })
            })

            logger.info('Gastro Offer Print - Populated families and subfamilies in gastro offer.')
            cb(null, doc)
          })

      }, (doc, cb) => {

          async.eachSeries(gastroOffer.versions.composition, function(compElement, cb_async) {

            if(compElement.element.kind == 'dish') { Model=Dish }
            else if (compElement.element.kind == 'product'){ Model = Product }
            else if (compElement.element.kind == 'drink'){ Model = Drink}
              
            Model.populate(compElement, { path: "element.item" }, (err, compElement) => {
              if (err) return cb(err)

              if(compElement.element.item&&compElement.element.item.versions) {

                //Filter active version
                let activeVersion = compElement.element.item.versions.filter((version) => {
                  return version.active==true;
                })

                compElement.element.item.versions = activeVersion;
                 
                compElement.allergens = compElement.element.item.versions[0].allergens;
                compElement.locationAllergens = compElement.element.item.versions[0].locationAllergens;

                gastroCostHelper.calculateGastroElementAvgLocCostAndAllergens(compElement, gastroOfferLocation);

                //Filter user language
                let userLang=[];

                userLang = activeVersion[0].lang.filter((langItem) => {
                  return langItem.langCode=userProfile.user.language;
                })
              }

              cb_async();
            });

      }, (err) => { //finished async loop
          logger.info('Gastro Offer Print - Refreshed dish, drink or product names in composition list and saved allergens info')
          cb(null, doc);
        }); 
      }, (doc, cb) => {

            gastroOffer.versions.composition.forEach((compElement)=> {
            //Update composition element unitCost with average location cost based on filterLocation

              if(compElement.element.item.versions[0].locationCost) { 
                compElement.locationCost = compElement.element.item.versions[0].locationCost;
              } else  {
                compElement.locationCost = [];
              }
              gastroCostHelper.calculateGastroElementAvgLocCostAndAllergens(compElement, gastroOfferLocation);

          });

       cb(null, doc);
      }, (doc, cb) => { //Get list of allergens in user language

          allergenHelper.getAllergens(userProfile, (err, aller) => {
            if(err) cb(err)
            allergens = aller;
            logger.info('Gastro Offer Print - Got list of allergens.')
            cb(null, doc)
          })

      }, (doc, cb) => { //Remove duplicate allergens

          gastroOffer.versions.composition.forEach((compElement) => { 
            aller = [];
            //populate recipes allergens
            compElement.allergens.forEach((recipeAllergen) => { 

              let subAllerId = new ObjectId(recipeAllergen.allergen);

              allergens.forEach((allergen) => {                
                let allergenId = new ObjectId(allergen._id)

                if(subAllerId.equals(allergenId)) {
                  recipeAllergen.allergen=allergen;
                  aller.push(recipeAllergen);
                  //console.log(allergen,'allergenpopulate')
                }
              })
            })
            // console.log(compElement.allergens.length,'lengthAllergens')
            allergensList=removeDuplicatesAllergens(aller);
            compElement.allergens=allergensList;

           //console.log(allergensList,'allergensListAfter')
                    
          })
                     
          //console.log(doc.versions,'Allergens')
          cb(null, doc) 

        },(doc,cb) => {
          
            async.eachSeries(gastroOffer.versions.composition,function(compElement,cb_async){
              
							let allergenArray=[];
              
              if(compElement.allergens){

									allergens.forEach((aller) => {

										let allerId = new ObjectId(aller._id);

										let index = compElement.allergens.findIndex((recipeAllergen) => {
	                    let recipeAllerId = new ObjectId(recipeAllergen.allergen._id);
											return allerId.equals(recipeAllerId);

										});

										let allerObj;
										let text;
										if(aller.lang&&aller.lang[0]) {text = aller.lang[0].name} else {text = '';}
                    if(index>-1) {
                      //console.log('setting level', compElement.name,'dish contains',recipeAllergen.allergen.lang[0].name)
											
											allerObj = {
												name: text,
												level: compElement.allergens[index].level
											}
                      //console.log(aller,'aller match of dish', compElement.name,'that contains recipeAllergen', recipeAllergen)
                    } else {
											
											allerObj = {
												name: text,
												level: null
											}
										}
										allergenArray.push(allerObj);
                  })
                  
									compElement.allergenArray=allergenArray;
                    //console.log(compElement.allergenArray,'allergenArray of', compElement.name)
									cb_async();
              
							} else {
                
								let text;
								if(aller.lang&&aller.lang[0]) {text = aller.lang[0].name} else {text = '';}
								
								allergens.forEach((aller) => {
									let allerObj = {
										level: null,
										name: text
									}
									allergenArray.push(allerObj);
								})
								compElement.allergenArray=allergenArray;
                cb_async();
              } 
 
            },(err) => {
              if(err) return cb(err)
              cb(null,doc)
            })

        }, (doc, cb) => { //Get template

          if(mongoose.Types.ObjectId.isValid(templateId)) {  
            Template.findById(templateId, (err, doc) => {
              if (err) cb(err);
              if (!doc) {
                var err = new Error('Document not found')
                err.statusCode = 404;
                cb(err);
              }else {
                 template=doc;
                // subTemplateName=template.lang[0].name;
                // console.log(template.lang,'template')
                // console.log(subTemplateName,'subTemplateName')
                cb(null, doc); 
              }
            })
          } else {
            var err = new Error('Invalid Object Id');
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
            // console.log(template,'template.template')
            // console.log(subTemplate,'subTemplate.template')
            //var subCompiled = _.template(subTemplate[0].template);
            let date = timeStamp();

            var location=[];

             let res = sortedStructure(setSubfamilyId(gastroOffer.versions.composition,fams));
             gastroOffer.versions.composition = breakOutStructure(res);

             gastroOffer.versions.composition.forEach((tableArray) => {
            //   //console.log(tableArray, 'tableArray')
                 tableArray.compElements.forEach((compElement) => {
            //       //console.log(compElement,'compElement')
                 })
             })
            //  if(menuType=='buffet' || menuType=='dailyMenuCarte'){
            // totalCost=totalMeanCost;
             //console.log(totalCost,'totalCost')
            // }
            // if(recipe){
            //   for(var i=0; i<3; i++)
            //   console.log(recipe,'recipe')
            //   console.log(i,'InRecipe')
            // }
                 //console.log(elementsList,'elementsList')
                  //console.log(recipe,'recipe')
                  //elementsList.shift();
                  //let firstComposition=composition.shift();
                  //let firstCookingSteps=cookSteps.shift();
                  //let firstAllergens=allergens.shift();
                  //let firstCompTotals=compTotals.shift();
                  //console.log(composition,'composition')
                  //console.log(gastroOffer.versions.composition,'gastroOffer')
                  allergens.forEach((allergen,index)=>{
                    //console.log(index,'index', allergen.lang,'allergenLang of' ,allergen._id,'allergenId')
                  })
                  //console.log(gastroOffer.versions.composition[0].compElements,'gastroOfferComposition')

                 i18n.setLocale(userProfile.user.language);
                  
                 html=compiled({
                  gastroOffer: gastroOffer,
                  numFamilies: numFamilies,
                  allergens: allergens, 
                  //cookingSteps: firstCookingSteps, 
                  //composition: firstComposition,
                  //compTotals: firstCompTotals, 
                  images: images,
                  //recipeType: menuType,
                  //simulationNetWeight: simulationNetWeight,
                  i18n: i18n,
                  date: date,
                  totalCost: totalCost
                  // ,
                  // subCompiled:subCompiled({
                  //   elementsList: elementsList,
                  //   recipe: recipe, 
                  //   composition: composition,
                  //   images: images,
                  //   tax:tax,
                  //   cookingSteps: cookSteps,
                  //   i18n: i18n,
                  //   date: date,
                  //   allergens: allergens,
                  //   compTotals: compTotals,
                  //   simulationNetWeight: simProcValues
                  //})
                });
                 
                 cb(null,doc);
                 //console.log(subCompiled,'subCompiled')

        }, (doc, cb) => { //convert html to pdf

          var options = {
            "border": {
              "top": "2mm",     // default is 0, units: mm, cm, in, px 
              "right": "8mm",
              "bottom": "0.5in",
              "left": "8mm"
            },
            "format": "A4",
            "orientation": "landscape",
            "header": {
                "height": "5mm"
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

      }], (err, stream) => {
        //console.log(err,'error')
        if (err) callback(err)
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

var breakOutStructure = (compositionArray) => { //Assumes the composition array has been tag with the function sortedStructure

  var compArray = [];
  var tableArray = [];
  var tableObj = {};

  compositionArray.forEach((compElement, index) => {

      if(index == 0) { //First time around, just store compElement in compArray

        compArray.push(compElement);

      } else {

        if(compElement.familyInit || compElement.subfamilyInit) {

          //Store comp Array in tableArray
          tableObj = {
            compElements: compArray
          }
          tableArray.push(tableObj);

          //reset compArray
          compArray = [];
          compArray.push(compElement);
        
        } else {

            compArray.push(compElement);
        
        }     
      }
  })

  //Store comp Array in tableArray
  tableObj = {
    compElements: compArray
  }
  tableArray.push(tableObj);

  return tableArray;
}

var sortedStructure = (compositionArray) => {
    var previousFamilyId=null;
    var previousSubfamilyId=null;
    var familyLength = 0;
    var subfamilyLength = 0;
    var previousFamilyInitIndex=0;
    var previousSubfamilyInitIndex=0;
    var numFamilies=0;
    var numSubfamilies=0;
    var subfamilyId=0;
    var allElements = compositionArray;
    var sortedElements = [];
    var filteredElements = [];
    var length=allElements.length;
    var numFams;
    
    //reset tags
    allElements.map((element)=>{
      element.familyInit=false;
      element.subfamilyInit=false;
    });

    allElements.forEach((element, index)=>{
      //console.log(element,'elementSorted')
      familyLength++;
      subfamilyLength++;
      
      if(element.family._id!=previousFamilyId)  {
        numFamilies++;
        element.familyInit=true;
        element.familyId=numFamilies;
        if(index>0) {
          allElements[previousFamilyInitIndex].familyLength=familyLength-1;
          allElements[previousFamilyInitIndex].numSubfamilies=numSubfamilies;
        }
        familyLength=1;
        numSubfamilies=0;
        subfamilyId=0;
        previousFamilyId=element.family._id;
        previousFamilyInitIndex=index;
      }
      // console.log(element,'element')
      // console.log(previousSubfamilyId,'previousSubfamilyId')
      if(element.subfamily._id!=previousSubfamilyId)  {
        numSubfamilies++;
        element.subfamilyInit=true;
        //console.log(element.subfamilyInit,'subfamilyIFinit')
        if (!(element.subfamily<0)) subfamilyId++;
        element.subfamilyId=numFamilies+'.'+subfamilyId;
        if(index>0) {
          allElements[previousSubfamilyInitIndex].subfamilyLength=subfamilyLength-1;
        }
        subfamilyLength=1;
        previousSubfamilyId=element.subfamily._id;
        //console.log(element.subfamily,'element.subfamily')
        previousSubfamilyInitIndex=index;        
      }

      element.numFamilies=numFamilies;
      let elementId=new ObjectId(element._id);
      let allElementsId= new ObjectId(allElements[length-1]._id);
      if(elementId.equals(allElementsId)){
        numFams=numFamilies;
      }     
    })

    if(allElements.length>0) {
      //Add length of last family and subfamily item
      allElements[previousFamilyInitIndex].familyLength=familyLength;
      allElements[previousFamilyInitIndex].numSubfamilies=numSubfamilies;
      allElements[previousSubfamilyInitIndex].subfamilyLength=subfamilyLength;
    }

    return allElements;
  }

  var setSubfamilyId = (compositionArray, families)=>{
    
    //Sets a 'bogus' subfamily id to dishes with null subfamily id. The 'bogus' id is negative and common for 
    //dishes within the same family. This 'bogus' id is used to group by subfamily all dishes with null subfamily within family.
    //When saving the menu composition, negative subfamily ids are reset to null.

    //console.log(this.menu.composition, 'dish composition list before filtering')

    //Filter dishes with subfamily null
    var elementsWithSubfamilyNull = compositionArray.filter((element) =>{
      return element.subfamily==null;
    })

    //Set subfamily id based on position of family in families array
    elementsWithSubfamilyNull.forEach((element) => {
      //console.log(element,'elementSubfamilyNull')
      var familyIndex;

      //get index of family in families array. There has to be a match, the alternative is not possible if 
      //referential integrity is working corectly.
      families.find((family, index) => {
        if(element.family._id == family._id) familyIndex=index;
      })

      //console.log(familyIndex, 'family index position')

      //Set id based on family index. 
      // Same method is used when adding/editing a dish without subfamily and setting a (bogus) id.
      element.subfamily= {
          _id: -(familyIndex+1),
          lang : {
            name : 'none'
          }
      } 
    })
    return compositionArray;
  }

  exports.download = (uri, filename, callback) => {
    request.head(uri, function(err, res, body){
      console.log('content-type:', res.headers['content-type']);
      console.log('content-length:', res.headers['content-length']);

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

var removeDuplicatesAllergens = (arr)=>{
  
  var i,j,cur,curLvl,found;
  for(i=arr.length-1;i>=0;i--){
    cur = new ObjectId(arr[i].allergen._id);
    curLvl = arr[i].level;
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= new ObjectId(arr[j].allergen._id);
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