var waterfall = require('async-waterfall');
var async = require('async');
var _ = require("underscore");
var pdf = require('html-pdf');
var cookingSteps = require('../helpers/cookingSteps');
var allergen = require('../helpers/allergen');
var printRecipeHelper = require('../helpers/printRecipe');
var calculateCost = require('../helpers/gastroCost');
var { ObjectId } = require('mongodb');
var Template = require('../models/template');
var Location = require('../models/location');
var Subproduct = require('../models/subproduct');
var Ingredient = require('../models/ingredient');
var Product = require('../models/product');
var Drink = require('../models/drinks');
var Dish = require('../models/dish');
var dish = require('../controllers/dish');
var drink = require('../controllers/drinks');
var Family = require('../models/family');
var mongoose = require('../node_modules/mongoose');
var fs = require('fs');
var allergenHelper = require('../helpers/allergen');
var gallery = require('../controllers/gallery')
var Gallery = require('../models/gallery');
var Allergen = require('../models/allergen');
var cookingStepsHelper = require('../helpers/cookingSteps');
var extractSubproductsHelper = require('../helpers/exportRecipe')
// var GastroComposition = require ('../models/GastroComposition')
var gastroCostHelper = require('../helpers/gastroCost');
var costHelper = require('../helpers/cost');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.printBooks;

exports.books = (Model, menuType, userLocIds, userProfile, id, templateId, tax, filterLocation, showSubproducts, callback) => {

  var subTemplateName;
  var template;
  // var recipe=[];
  // var recipes=[];
  var subTemplate;
  var subproductsTemplate;
  var html;
  var composition = [];
  var pricing = [];
  var compositionArray = [];
  var elementsList = [];
  var allergens = [];
  var allergensComp = [];
  var allergensList = [];
  var aller = [];
  var gastroOffer;
  var versionId;
  var compTotals = [];
  var simProcValues = [];
  var itemParent;
  var simValue = [];
  var numFamilies;
  var totalCost;
  var allergens;
  var libraryAllergens;
  var allergenTextList = '';
  var totalMeanCost = [];
  var fams = [];
  var compositionImages = [];
  var dishes = [];
  var drinks = [];
  var subproducts = [];
  var gastroOfferLocation;
  var Location = require('../models/location');
  var i18n = require('i18n');

  logger.info('Print Books - Entering print books.')
  logger.info('menuType : ', menuType);
  logger.info('userLocIds : %j ', userLocIds);
  logger.info('Gastro offer id : %s ', id);
  logger.info('Template id : %s ', templateId);
  logger.info('tax : %s ', tax);
  logger.info('filterLocation : %j ', filterLocation);
  logger.info('showSubproducts : %j ', showSubproducts);

  if (showSubproducts == 'true') showSubproducts = true;
  else showSubproducts = false;

  async.waterfall([
    (cb) => {
      // let elementsList=[];

      if (mongoose.Types.ObjectId.isValid(id)) {   //Get active version of gastro offer

        Model.aggregate([
          {
            $unwind:
              { path: "$versions" }
          },
          { $match: { '_id': id } },
          { $match: { 'versions.lang.langCode': userProfile.user.language } },
          { $match: { 'versions.active': true } }
        ], (err, doc) => {
          if (err) return cb(err)
          //console.log(doc[0],'doc')
          gastroOfferLocation = doc[0].location;
          versionId = doc[0].versions._id;
          cb(null, doc)
        })
      } else {
        var err = new Error('Invalid Object Id');
        err.statusCode = 400;
        cb(err)
      }

    }, (doc, cb) => {

      if (filterLocation && filterLocation.length) gastroCostHelper.calculateAvgGastroLocCost(doc);
      cb(null, doc)

    }, (doc, cb) => { //populate gastroOffer

      Model.populate(doc[0], { path: "location versions.type versions.season versions.last_account versions.composition.family" }, (err, doc) => {
        if (err) return cb(err)
        gastroOffer = doc;
        cb(null, doc)
      })

    }, (doc, cb) => {  //Get first page image from gastroOffer location

      let locCompanies = [];

      doc.location.forEach((loc) => { //Get companies from location list. Companies have a parent_organitzation but do not have parent_companies
        //if (loc.parent_organization && !loc.parent_company) locCompanies.push(loc)
        locCompanies.push(loc)
      })

      if (locCompanies.length) {

        //Populate companies gallery field
        Gallery.populate(locCompanies, { path: 'gallery' }, (err, docs) => {
          if (err) return cb(err)


          //Filter images with gallery key
          let firstTitleImage = docs.filter((doc) => {
            return doc.gallery
          })

          if (firstTitleImage.length) {
            //Extract image
            firstTitleImage = firstTitleImage.map((doc) => {
              return doc.gallery.sizes[1].url;
            })
          }

          gastroOffer.firstPageImage = firstTitleImage;

          cb(null, doc)
        })

      } else {
        gastroOffer.firstPageImage = [];
        cb(null, doc)
      }

    }, (doc, cb) => {  //Populate families and subfamilies in gastro composition list

      logger.info('Print Books - Populating families and subfamilies in gastro offer.')

      Family.aggregate([
        { $unwind: "$lang" },
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
        { $match: { $or: [{ 'subfamilies.lang.langCode': userProfile.user.language }, { 'subfamilies.lang.langCode': null }] } },
        { $match: { 'lang.langCode': userProfile.user.language } },
        { $match: { 'category': 'gastroOffering' } },
        {
          $group: {
            "_id": "$_id",
            "lang": { $first: "$lang" },
            "category": { $first: "$category" },
            "subfamilies": { $push: '$subfamilies' },
          }
        },
      ], (err, families) => { //Populate families

        if (err) return cb(err)

        gastroOffer.versions.composition.forEach((compElement) => {

          families.forEach((fam, index) => {
            fams.push(fam);
            let famId = new ObjectId(fam._id)
            let elementFamId = compElement.family
            if (famId.equals(elementFamId._id)) {
              compElement.family = fam;
              families[index].subfamilies.forEach((subfam) => {
                //console.log(subfam,'subfam')
                let subfamId = new ObjectId(subfam._id)
                let elementSubFamId = null;
                if (mongoose.Types.ObjectId.isValid(compElement.subfamily))
                  elementSubFamId = new ObjectId(compElement.subfamily)
                if (subfamId.equals(elementSubFamId)) {
                  compElement.subfamily = subfam;
                }
              })
            }
          })
        })

        cb(null, doc)
      })

    }, (doc, cb) => { //Get template

      if (mongoose.Types.ObjectId.isValid(templateId)) {

        Template.findById(templateId, (err, doc) => {
          if (err) cb(err);
          if (!doc) {
            var err = new Error('Document not found')
            err.statusCode = 404;
            cb(err);
          } else {
            template = doc;
            // console.log(subTemplateName,'subTemplateName')
            logger.info('Print Books - Got template')
            cb(null, doc);
          }
        })
      } else {
        var err = new Error('Invalid Object Id');
        err.statusCode = 400;
        return cb(err)
      }

    }, (doc, cb) => {

      Template.find(
        {
          category: "subTemplate",
          parentTemplateCode: template.templateCode
        })
        .exec((err, doc) => {
          if (err) return cb(err)
          if (doc && doc.length) subTemplate = doc[0];
          else
            subTemplate =
              {
                templateCode: '000',
                template: ''
              };
          cb(null, doc)
        })

    }, (doc, cb) => {

      if (subTemplate.templateCode == "SB002") { //Cost book for subproducts

        Template.find({ category: "subTemplate", templateCode: "SS004" })
          .exec((err, doc) => {
            if (err) return cb(err)
            subproductsTemplate = doc;
            //console.log(subproductsTemplate[0].template,'subproductsTemplate')
            cb(null, doc)
          })

      } else if (subTemplate.templateCode == "SB001" && showSubproducts) { //Recipes book for subproducts

        Template.find({ category: "subTemplate", templateCode: "SS005" }) //Template that includes subproducts
          .exec((err, doc) => {
            if (err) return cb(err)
            subproductsTemplate = doc;
            cb(null, doc)
          })

      } else {
        cb(null, doc)
      }

    }, (doc, cb) => {

      logger.info('Print Books - Refreshing dish, drink or product names in composition list and saving allergens info')

      //Filter dish or product or drink lang field of composition based on user language
      async.eachSeries(gastroOffer.versions.composition, function (compElement, cb_async) {

        if (compElement.element.kind == 'dish') { Model = Dish }
        else if (compElement.element.kind == 'product') { Model = Product }
        else if (compElement.element.kind == 'drink') { Model = Drink }

        Model.populate(compElement, { path: "element.item" }, (err, compElement) => {
          if (err) return cb(err)

          if (compElement.element.item && compElement.element.item.versions) {

            compElement.allergens = compElement.element.item.versions[0].allergens;
            compElement.locationAllergens = compElement.element.item.versions[0].locationAllergens;

            //Update recipe cost based on filterLocation
            costHelper.calculateAvgRecipeLocCostAndAllergens([compElement.element.item], Model);

            //Filter active version
            let activeVersion = compElement.element.item.versions.filter((version) => {
              return version.active;
            })

            //Filter user language
            let userLang = [];

            userLang = activeVersion[0].lang.filter((langItem) => {
              return langItem.langCode == userProfile.user.language;
            })

            if (userLang.length) compElement.name = userLang[0].name;

            //Save allergens
            compElement.allergens = activeVersion[0].allergens;
            if (menuType == 'catalog') {
              compElement.price = activeVersion[0].refPrice;
            } else {
              compElement.price = activeVersion[0].refPricePerServing;
            }
            logger.info('active versions: %j', activeVersion[0].lang[0].name)

            //Save activeVersion
            compElement.element.item.versions = activeVersion;

            //logger.info('compElement.element.item.versions: %j', compElement.element.item.versions.lang)

            //Update recipe composition costs based on filterLocation
            compElement.element.item.versions[0].composition.forEach((recipeElement) => {

              if (compElement.element.kind == 'subproduct') { //composition element is a subproduct

                //Update composition element unitCost with average location cost based on filterLocation
                costHelper.calculateCompElementAvgLocCostAndAllergens(recipeElement, gastroOffer.location, Subproduct);

              } else { //composition element is an ingredient

                //Update composition element unitCost with average location cost based on filterLocation
                costHelper.calculateCompElementAvgLocCostAndAllergens(recipeElement, gastroOffer.location, Ingredient);
              }
            })
          }

          cb_async();
        });

      }, (err) => { //finished async loop
        cb(null, doc);
      });

    }, (doc, cb) => { //Get conversion table

      costHelper.getConversionTable((err, table) => {
        conversionTable = table;
        cb(null, doc);
      })

    }, (doc, cb) => {

      gastroOffer.versions.composition.forEach((compElement) => {
        //Update composition element unitCost with average location cost based on filterLocation
        compElement.allergens = compElement.element.item.versions[0].allergens;
        compElement.locationAllergens = compElement.element.item.versions[0].locationAllergens;    
        gastroCostHelper.calculateGastroElementAvgLocCostAndAllergens(compElement, gastroOfferLocation);
      });

      cb(null, doc);

    }, (doc, cb) => { //Recalculate recipe composition elements cost

      gastroOffer.versions.composition.forEach((gastroCompElement) => {

        //Calculate costs of all elements using conversion table
        gastroCompElement.element.item.versions[0].composition.forEach((recipeElement) => {

          if (recipeElement.measuringUnit == null) { //measuring unit is an equivalence unit. Gross weight is already expressed in base unit.

            recipeElement.grossWeight = recipeElement.equivalenceUnit.quantity * recipeElement.quantity;
            recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;

          } else {

            let measuringUnitId = new ObjectId(recipeElement.measuringUnit);
            let baseUnitId = new ObjectId(recipeElement.baseUnit);
            if (!measuringUnitId.equals(baseUnitId)) { //measuring unit is different than base unit, so we need conversion factor
              //Find conversion quantity in convertion table. Start by finding base unit...
              conversionTable.find((x) => {
                if (x.baseUnit._id == recipeElement.baseUnit) {
                  //Now find the conversion quantity in conversions object
                  x.conversions.find((c) => {
                    if (c.convUnit._id == recipeElement.measuringUnit) {
                      let conversionQty = c.quantity;
                      recipeElement.calculatedCost = recipeElement.grossWeight * conversionQty * recipeElement.unitCost;
                    }
                  })
                }
              })
            } else { //Measuring unit is equal to base unit, so there's no need for conversion
              //console.log('calculating calculatedCost: grossWeight= ' + recipeElement.grossWeight+ 'unit cost: '+recipeElement.unitCost)
              recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;
            }
          }

        })
      })

      cb(null, doc)

    }, (doc, cb) => {

      // analizar casos para todos los menuTypes y cambiar en funcion de la necesidad de calculos. menu,dailyMenuCarte,fixedPriceCarte y buffet necesitan funcion tagFamilies, setSubfamilyId,etc,.. para poder calcular familyMeanCost,subFamilyMeanCost,etc,... mirar printGastroOffer para ver como modificar para obtener los valores que faltan.
      async.eachSeries(gastroOffer.versions.composition, function (gastroCompElement, cb_async) {

        if (gastroCompElement.element.item && gastroCompElement.element.item.versions) { // mirar de poder poner otra condicion con menuType y en el otro else hacer calculos para los que son diferentes de carte

          let compTotal = {
            grossWeight: 0,
            netWeight: 0,
            cost: 0
          };
          //console.log(gastroCompElement.element.item.versions[0].composition.length,'compElement')

          gastroCompElement.element.item.versions[0].composition.forEach((recipeCompElement) => {
            compTotal.grossWeight += recipeCompElement.grossWeight;
            let netWeight = recipeCompElement.grossWeight * (1 - (recipeCompElement.wastePercentage / 100));
            compTotal.netWeight += netWeight;
            compTotal.cost += recipeCompElement.calculatedCost;
            console.log(compTotal, 'compTotals');
          })

          if (gastroCompElement.element.kind == 'dish') { Model = Dish }
          else if (gastroCompElement.element.kind == 'product') { Model = Product }
          else if (gastroCompElement.element.kind == 'drink') { Model = Drink }

          let recipeCompSortedElement;

          if (menuType != 'catalog')
            recipeCompSortedElement = printRecipeHelper.sortedCategory(gastroCompElement.element.item.versions[0].composition);
          else
            recipeCompSortedElement = gastroCompElement.element.item.versions[0].composition

          gastroCompElement.element.item.versions[0].composition = recipeCompSortedElement;
          gastroCompElement.compTotals = compTotal;
          var cookSteps = [];

          cookingSteps.getCookSteps(gastroCompElement.element.item._id, gastroCompElement.element.item.versions[0]._id, Model, userProfile, (err, doc) => {
            if (err) return cb(err)
            //console.log(doc,'doc')
            cookSteps = doc;
            gastroCompElement.cookingSteps = cookSteps;
            //console.log(gastroCompElement,'gastroOffer') 
            cb_async();
          })
        }
      }, (err) => {
        cb(null, doc);
      });

    }, (doc, cb) => {

      if ((subTemplate.templateCode == "SB001" && showSubproducts) || subTemplate.templateCode == "SB002") { //Obtain list of subproducts of each recipe

        let subproductsList = [];

        async.eachSeries(gastroOffer.versions.composition, (gastroCompElement, cb_async) => {

          let parent = [];

          switch (gastroCompElement.element.kind) {
            case 'drink':
              Model = Drink
              break;

            case 'dish':
              Model = Dish
              break;

            case 'product':
              Model = Product
              break;

            case 'subproduct':
              Model = Subproduct
              parent = parent.concat(gastroCompElement.element.item._id)
              break;
          }

          extractSubproductsHelper.extractSubproductsInRecipe(gastroCompElement.element.item._id, Model, parent, filterLocation, (err, elementsList) => {

            subproductsList = elementsList;

            if (subproductsList.length) {

              Subproduct.aggregate([   //Get subproducts
                {
                  $unwind: {
                    path: "$versions",
                    preserveNullAndEmptyArrays: true
                  }
                },
                {
                  $unwind: {
                    path: "$versions.lang",
                    preserveNullAndEmptyArrays: true
                  }
                },
                { $match: { '_id': { $in: subproductsList } } },
                { $match: { 'versions.active': true } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } }

              ], (err, docs) => {

                if (err) return cb(err)
                logger.info('Get subproducts from list of ObjectIds. Total count: %s', docs.length)

                //Flag docs as subproduct
                docs.map((doc) => {
                  doc.type = 'subproduct'
                })

                async.waterfall([

                  (cb_1) => {

                    Subproduct.populate(docs, { path: "measurementUnit family versions.last_account versions.cookingSteps.process versions.cookingSteps.utensil" }, (err, docs) => {
                      if (err) return cb_1(err)
                      cb_1(null, true)
                    });

                  }, (doc, cb_1) => {

                    Allergen.populate(docs, { path: "versions.allergens.allergen" }, (err, docs) => {
                      if (err) return cb_1(err)
                      cb_1(null, true)
                    })

                  }, (doc, cb_1) => {

                    Gallery.populate(docs, { path: "versions.gallery versions.allergens.allergen.gallery" }, (err, docs) => {
                      if (err) return cb_1(err)
                      cb_1(null, true)
                    })

                  }], (err, doc) => {
                    if (err) return cb_async()(err)
                    let sortedArray = [];

                    docs.forEach((doc) => {
                      let docId = new ObjectId(doc._id)
                      subproductsList.forEach((subproduct, i) => {
                        let subproductId = new ObjectId(subproduct)
                        if (subproductId.equals(docId)) {
                          sortedArray[i] = doc;
                        }
                      });
                    });
                    gastroCompElement.subproducts = sortedArray
                    cb_async()
                  })
              })
            }
            else {
              cb_async()
            }
          })

        }, (err) => {
          cb(null, doc);
        })

      } else {
        cb(null, doc)
      }

    }, (doc, cb) => { //Get list of allergens in user language

      allergenHelper.getAllergens(userProfile, (err, aller) => {
        if (err) return cb(err)
        allergens = aller;
        logger.info('Print Books - Got allergen list')
        cb(null, doc)
      })

    }, (doc, cb) => {

      gastroOffer.versions.composition.forEach((compElement) => {
        aller = [];
        //populate recipes allergens
        compElement.allergens.forEach((recipeAllergen) => {

          let subAllerId = new ObjectId(recipeAllergen.allergen);

          allergens.forEach((allergen) => {
            let allergenId = new ObjectId(allergen._id)

            if (subAllerId.equals(allergenId)) {
              recipeAllergen.allergen = allergen;
              aller.push(recipeAllergen);
              //console.log(allergen,'allergenpopulate')
            }
          })
        })
        // console.log(compElement.allergens.length,'lengthAllergens')
        allergensList = removeDuplicatesAllergens(aller);
        compElement.allergens = allergensList;
        //console.log(allergensList,'allergensListAfter')

        allergenTextList = '';

        //Generate allergen text for csv
        allergensList.forEach((recipeAllergen) => {
          allergenTextList = allergenTextList.concat(recipeAllergen.allergen.lang[0].name)

          switch (recipeAllergen.level) {
            case 0:
              allergenTextList = allergenTextList + '(No contiene), '
              break;

            case 1:
              allergenTextList = allergenTextList + '(Contiene trazas), '
              break;

            case 2:
              allergenTextList = allergenTextList + '(Contiene), '
              break;
          }

        })
        //Store allergen text list
        compElement.allergenTextList = allergenTextList;

      })

      //console.log(doc.versions,'Allergens')
      logger.info('Print Books - Populated allergens in list of recipes and generated allergen text.')
      cb(null, doc)

    }, (doc, cb) => {

      async.eachSeries(gastroOffer.versions.composition, (compElement, async_cb) => {

        Gallery.populate(compElement, { path: "element.item.versions.gallery" }, (err, doc) => {

          if (err) return async_cb(err)

          let activeVersion = compElement.element.item.versions.filter((version) => {
            return version.active == true;
          })

          if (activeVersion[0].gallery) {
            //console.log(activeVersion[0].gallery,'activeVersion.gallery')
            compElement.gallery = activeVersion[0].gallery.sizes[1].url;
          } else {
            compElement.gallery == null;
          }

          async_cb()

        })

      }, (err) => { //Finished async loop
        if (err) return cb(err)
        logger.info('Print Books - Obtained recipe images')
        cb(null, doc)
      })

    }, (doc, cb) => { //Calculate composition totals

      compositionArray = setSubfamilyId(gastroOffer.versions.composition, fams);

      logger.info('Print Books - Set subfamily ids in composition list')

      composition = sortedStructure(compositionArray);

      logger.info('Print Books - Tagged composition list: %j', composition)

      if (menuType == 'dailyMenuCarte' || menuType == 'fixedPriceCarte') {
        calculateCost.CostsForDailyMenuAndFixedPriceCartesForPrint(composition, menuType, (err, res) => {
          if (err) return cb(err)
          gastroOffer.versions.totalCost = res;
          cb(null, res)
        })
      } else {
        var sumOfCosts = 0;
        composition.forEach((element) => {
          sumOfCosts += element.totalCost;
        })
        totalCost = sumOfCosts;
        logger.info('Print Books - Calculate compostion totals')
        cb(null, doc)
      }

    }, (doc, cb) => { //Fill out template and generate html

      let base64ImgPlaceholder = base64_encode('./templates/assets/img/img_placeholder_food.png');
      let base64ImgTexture = base64_encode('./templates/assets/img/texture.png');
      let base64ImgCircle = base64_encode('./templates/assets/img/noImageCircle.png');
      let base64logoGreen = base64_encode('./templates/assets/img/logo_green.png');
      let base64logo = base64_encode('./templates/assets/img/logo.png');
      let base64CookDesign = base64_encode('./templates/assets/img/cookdesign-logo-medium.png');
      let images = {
        imgPlaceholder: 'data:image/png;base64,' + base64ImgPlaceholder,
        imgTexture: 'data:image/png;base64,' + base64ImgTexture,
        imgCircle: 'data:image/png;base64,' + base64ImgCircle,
        imgLogo: 'data:image/jpg;base64,' + base64logoGreen,
        logo: 'data:image/png;base64,' + base64logo,
        cookDesign: 'data:image/png;base64,' + base64CookDesign
      }
      var compiled = _.template(template.template);
      var recipeListTemplate = _.template(subTemplate.template);
      var subproductsListTemplate = '';
      if (subTemplate.templateCode == 'SB002') {
        subproductsListTemplate = _.template(subproductsTemplate[0].template);
      }
      if (subTemplate.templateCode == 'SB001' && showSubproducts) { // && showSubproducts == true
        console.log('Show subproducts!')
        subproductsListTemplate = _.template(subproductsTemplate[0].template);
      }

      logger.info('Print Books - Compiled template')

      let date = timeStamp();

      var location = [];
      gastroOffer.versions.composition = breakOutStructure(composition, menuType);
      logger.info('Print Books - Separated families and subfamilies in separate tables, compositionLength: %s', composition.length)

      gastroOffer.versions.composition.forEach((tableArray, index) => {
        //console.log(tableArray, 'tableArray')
        tableArray.compElements.forEach((compElement) => {
          //console.log(compElement.element.item.versions,'compElementComposition')
          //console.log(compElement,'compElement')
        })
      })

      i18n.setLocale(userProfile.user.language);

      html = compiled({
        gastroOffer: gastroOffer,
        numFamilies: numFamilies,
        images: images,
        i18n: i18n,
        date: date,
        tax: Number(tax),
        menuType: menuType,
        totalCost: totalCost,
        recipeListTemplate: recipeListTemplate,
        subproductsListTemplate: subproductsListTemplate
      });

      logger.info('Print Books - Generated html from template')

      cb(null, doc);
      //console.log(subCompiled,'subCompiled')

    }, (doc, cb) => { //convert html to pdf

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
          "height": "5mm",
          "contents": {
            first: '',
            2: '', // Any page number is working. 1-based index 
            default: '' // fallback value 
          }
        },
        "timeout": "1200000" //20 min
      }

      pdf.create(html, options).toStream(function (err, stream) {
        if (err) return cb(err);
        logger.info('Print Books - Created pdf')
        cb(null, stream)
      });

    }], (err, stream) => {
      if (err) return callback(err)
      callback(null, stream)
    })
}

exports.subproductsInLocation = (Model, userLocIds, userProfile, templateId, tax, filterLocation, callback) => {

  var subproducts = [];
  var template;
  var html;
  var locationWithSubproducts = {};
  var listOfSubproductsByLocation = [];
  var user = userProfile;
  var printUser
  var i18n = require('i18n');

  logger.info('Print Subproducts Book - Entering print subproducts in location.')
  logger.info('userLocIds : %j ', userLocIds);
  logger.info('Template id : %s ', templateId);
  logger.info('tax : %s ', tax);
  logger.info('userProfile: %j', userProfile)
  logger.info('filterLocation : %j ', filterLocation);

  async.waterfall([

    (cb) => {

      if (filterLocation && filterLocation.length) {

        Model.aggregate([   //Get subproducts
          {
            $unwind: {
              path: "$versions",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $unwind: {
              path: "$versions.lang",
              preserveNullAndEmptyArrays: true
            }
          },
          { $match: { 'location': { $in: filterLocation } } },
          { $match: { 'versions.active': true } },
          { $match: { 'versions.lang.langCode': userProfile.user.language } },
          { $sort: { 'versions.lang.name': 1 } }
        ], (err, docs) => {

          if (err) {
            logger.error(err)
            return cb(err)
          }

          logger.info('Print Subproducts in Location --- Get subproducts from list of ObjectIds in Location. Total count: %s', docs.length)
          //Flag docs as subproduct
          docs.map((doc) => {
            doc.type = 'subproduct'
          })
          if (err) return cb(err)
          Subproduct.populate(docs, { path: "measurementUnit family family.subfamilies versions.gallery versions.last_account versions.pricing versions.cookingSteps.process versions.cookingSteps.utensil " }, (err, docs) => {
            if (err) return cb(err)
            //console.log(docs,'docs')
            subproducts = docs;
            logger.info('Print Subproducts in Location --- Populated of all subproducts in Location. Total count : %s', subproducts.length)
            //console.log(gastroCompElement.subproducts,'gastroCompElement.subproducts')
            cb(null, docs)  // remember to change getSubproductsInPrintElement for extractSubproductsInRecipe in exportRecipe
          });
        })

      } else {

        Model.aggregate([   //Get subproducts
          {
            $unwind: {
              path: "$versions",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $unwind: {
              path: "$versions.lang",
              preserveNullAndEmptyArrays: true
            }
          },
          { $match: { 'versions.active': true } },
          { $match: { 'versions.lang.langCode': userProfile.user.language } },
          { $sort: { 'versions.lang.name': 1 } }
        ], (err, docs) => {

          if (err) {
            logger.error(err)
            return cb(err)
          }

          logger.info('Print Subproducts in Location --- Get subproducts from list of ObjectIds in all Locations. Total count: %s', docs.length)
          //Flag docs as subproduct
          docs.map((doc) => {
            doc.type = 'subproduct'
          })
          if (err) return cb(err)
          Subproduct.populate(docs, { path: "measurementUnit family family.subfamilies versions.gallery versions.last_account versions.pricing versions.cookingSteps.process versions.cookingSteps.utensil " }, (err, docs) => {
            if (err) return cb(err)
            //console.log(docs,'docs')
            subproducts = docs;
            logger.info('Print Subproducts in Location --- Populated of all subproducts in all Locations. Total count : %s', subproducts.length)
            //console.log(gastroCompElement.subproducts,'gastroCompElement.subproducts')
            cb(null, docs)  // remember to change getSubproductsInPrintElement for extractSubproductsInRecipe in exportRecipe
          });
        })

      }

    }, (doc, cb) => {

      if (mongoose.Types.ObjectId.isValid(templateId)) {

        Template.findById(templateId, (err, doc) => {
          if (err) return cb(err);
          if (!doc) {
            var err = new Error('Document not found')
            err.statusCode = 404;
            return cb(err);
          } else {
            template = doc;
            // console.log(subTemplateName,'subTemplateName')
            logger.info('Print Subproducts in Location - Got template')
            cb(null, doc);
          }
        })
      } else {
        var err = new Error('Invalid Object Id');
        err.statusCode = 400;
        return cb(err)
      }

    }, (doc, cb) => {

      let inLocation = [];

      // console.log(subproducts,'subproducts')
      // console.log(filterLocation,'filterLocation')
      filterLocation.forEach((location) => {

        subproducts.forEach((subproduct) => {
          //console.log(location,'location')
          let inLocationSub = subproduct.location.filter((subLoc) => {
            //console.log(subLoc,'subLoc')
            return subLoc.equals(location);
          })
          //console.log(inLocationSub.length,'inLocationSubLength')
          if (inLocationSub.length > 0) {
            //console.log('match beetween loc so pushing subproduct')
            inLocation.push(subproduct)
          }
          inLocationSub = [];
        })
        //console.log(inLocation.length,'inLocationLength','subproductsLength',subproducts.length)
        locationWithSubproducts = {
          location: location,
          subproducts: inLocation
        }

        listOfSubproductsByLocation.push(locationWithSubproducts)
        inLocation = [];
        //console.log(locationWithSubproducts,'locationWithSubproducts')

      })
      cb(null, doc)

    }, (doc, cb) => {

      Location.populate(listOfSubproductsByLocation, { path: "location" }, (err, doc) => {
        if (err) return cb(err)
        cb(null, doc)
      })

    }, (doc, cb) => {

      let base64ImgPlaceholder = base64_encode('./templates/assets/img/img_placeholder_food.png');
      let base64ImgTexture = base64_encode('./templates/assets/img/texture.png');
      let base64ImgCircle = base64_encode('./templates/assets/img/noImageCircle.png');
      let base64logoGreen = base64_encode('./templates/assets/img/logo_green.png');
      let base64logo = base64_encode('./templates/assets/img/logo.png');
      let base64CookDesign = base64_encode('./templates/assets/img/cookdesign-logo-medium.png');
      let images = {
        imgPlaceholder: 'data:image/png;base64,' + base64ImgPlaceholder,
        imgTexture: 'data:image/png;base64,' + base64ImgTexture,
        imgCircle: 'data:image/png;base64,' + base64ImgCircle,
        imgLogo: 'data:image/jpg;base64,' + base64logoGreen,
        logo: 'data:image/png;base64,' + base64logo,
        cookDesign: 'data:image/png;base64,' + base64CookDesign
      }
      var compiled = _.template(template.template);

      logger.info('Print Subproducts in Location - Compiled template')

      let date = timeStamp();

      var location = [];

      //console.log(userProfile,'userProfile');

      i18n.setLocale(userProfile.user.language);

      html = compiled({
        subproducts: listOfSubproductsByLocation,
        images: images,
        i18n: i18n,
        date: date,
        printUser: user,
        tax: Number(tax)
      });

      logger.info('Print Subproducts in Location - Generated html from template')

      cb(null, doc);

    }, (doc, cb) => {
      //console.log(subproducts,'subproducts')
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
          "height": "5mm",
          "contents": {
            first: '',
            2: '', // Any page number is working. 1-based index 
            default: '' // fallback value 
          }
        },
        "timeout": "1200000" //20 min
      }

      pdf.create(html, options).toStream(function (err, stream) {
        if (err) return cb(err);
        logger.info('Print Subproducts in Location - Created pdf')
        cb(null, stream)
      });

    }], (err, stream) => {

      if (err) return callback(err)
      callback(null, stream)

    })

}


exports.subproductsInLocationDetailed = (Model, userLocIds, userProfile, templateId, tax, filterLocation, callback) => {

  var subproducts = [];
  var template;
  var html;
  var locationWithSubproducts = {};
  var listOfSubproductsByLocation = [];
  var user = userProfile;
  var printUser
  var i18n = require('i18n');

  logger.info('Print Subproducts Book - Entering print subproducts in location detailed.')
  logger.info('userLocIds : %j ', userLocIds);
  logger.info('Template id : %s ', templateId);
  logger.info('tax : %s ', tax);
  logger.info('userProfile: %j', userProfile)
  logger.info('filterLocation : %j ', filterLocation);

  async.waterfall([

    (cb) => {

      var result = [];

      var cursor = Subproduct.aggregate([   //Get subproducts
          {
            $unwind: {
              path: "$versions",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $unwind: {
              path: "$versions.lang",
              preserveNullAndEmptyArrays: true
            }
          },
          { $match: { 'location': { $in: filterLocation } } },
          { $match: { 'versions.active': true } },
          { $match: { 'versions.lang.langCode': userProfile.user.language } },
          { $sort: { 'versions.lang.name': 1 } }
        ])
        .cursor({ batchSize: 1000, useMongooseAggCursor: true })
        .exec();

        cursor.eachAsync((subproducts) => {

            logger.info('Entering subproducts cursor..');

            // if (err) {
            //   logger.error(err)
            //   return cb_each(err)
            // }

            new Promise(
              (resolve, reject) => {
  
                async.waterfall([
      
                  (cb_1) => {
      
                    Subproduct.populate(subproducts, { path: "measurementUnit versions.last_account versions.cookingSteps.process versions.cookingSteps.utensil" }, (err, docs) => {
                      if (err) return cb_1(err)
                      cb_1(null, true)
                    });
      
                  }, (doc, cb_1) => {
      
                    Allergen.populate(subproducts, { path: "versions.allergens.allergen" }, (err, docs) => {
                      if (err) return cb_1(err)
                      cb_1(null, true)
                    })
      
                  }, (doc, cb_1) => {
      
                    Family.populate(subproducts, { path: "family subfamily" }, (err, docs) => {
                      if (err) return cb_1(err)
                      cb_1(null, true)
                    })
      
                  }, (doc, cb_1) => {
      
                    Gallery.populate(subproducts, { path: "versions.gallery versions.allergens.allergen.gallery" }, (err, docs) => {
                      if (err) return cb_1(err)
                      cb_1(null, true)
                    })
      
                  }, (doc, cb_1) => {
      
                      Location.populate(subproducts, { path: "location" }, (err, docs) => {
                        if (err) return ccb_1b(err)
                        cb_1(null, true);
                      }) 
      
                  }], (err, doc) => {
                    if (err) reject();
                    result.push(subproducts);
                    resolve();
                  })
              });
        }, (err) => {
            if (err) return cb(err);
            logger.info('Retrieved %s subproducts', result.length);
            cb(null, result)
        });          

    }, (subproducts, cb) => {

      async.eachSeries(subproducts, function(subproduct, cb_async_1) {

        costHelper.calculateAvgRecipeLocCostAndAllergens([subproduct], Subproduct);

        async.eachSeries(subproduct.versions.composition, function(compElement, cb_async_2) {

          if(compElement.element.kind == 'subproduct') { //composition element is a subproduct

            Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
              if (err) return cb(err)

              if(compElement.element.item != null) {

                //Filter active version
                let activeVersion = compElement.element.item.versions.filter((version) => {
                  return version.active==true;
                })

                if(activeVersion.length) {

                    compElement.element.item.versions = activeVersion;
                    compElement.active = compElement.element.item.active;

                    //Store location of subproduct
                    compElement.location = compElement.element.item.location;

                    //Udpdate unit cost and locationCost of subproduct
                    compElement.unitCost = compElement.element.item.versions[0].unitCost;

                    if(compElement.element.item.versions[0].locationCost) { 
                      compElement.locationCost = compElement.element.item.versions[0].locationCost;
                    } else  {
                      compElement.locationCost = [];
                    }

                    compElement.allergens = compElement.element.item.allergens;

                    if(compElement.element.item.versions[0].locationAllergens) { 
                      compElement.locationAllergens = compElement.element.item.versions[0].locationAllergens;
                    } else  {
                      compElement.locationAllergens = [];
                    }

                    //Update composition element unitCost with average location cost based on filterLocation
                    costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, subproduct.location, Subproduct);

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
              } else {
                  logger.error('Could not retrive active version of dish in recipe composition. Subproduct id: %s', subproductId, ' and version id: ', versionId);
                  let err= new Error('Could not retrive active version of dish in recipe composition')
                  return cb_async_2(err)		           	
              }


              } else {
                compElement.itemNull = true;
                logger.error('Could not populate subproduct in subproduct recipe. Subproduct id: %s', subproductId, ' and version id: ', versionId);
                let err = new Error('Could not populate subproduct in subproduct recipe')
                return cb_async_2(err)
              }

              cb_async_2();
            });

          } else { //composition element is an ingredient

            Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
              if (err) return cb(err)

              if(compElement.element.item != null) {
                  compElement.active = compElement.element.item.active;
                  //Udpdate unit cost and locationCost of ingredient
                compElement.unitCost = compElement.element.item.referencePrice;
                if(compElement.element.item.locationCost) { 
                  compElement.locationCost = compElement.element.item.locationCost; 
                } else {
                  compElement.locationCost = [];
                }

                compElement.allergens = compElement.element.item.allergens;

                if(compElement.element.item.locationAllergens) { 
                  compElement.locationAllergens = compElement.element.item.locationAllergens; 
                } else {
                  compElement.locationAllergens = [];
                }

                //Update composition element unitCost with average location cost based on filterLocation
                costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, subproduct.location, Ingredient);

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
                
              } else {
                compElement.itemNull = true;
                logger.error('Could not populate ingredient in subproduct recipe. Dish id: %s', subproductId, ' and version id: ', versionId)
              }

              cb_async_2();
            }); 
          }       

        }, (err) => { //finished async loop
          cb_async_1();
        });

      }, (err) => { //finished subproducts async loop
        cb(null, subproducts);
      });

    }, (subproducts, cb) => { //Get conversion table

      costHelper.getConversionTable((err, table) => {
        conversionTable = table;
        cb(null, subproducts);
      })

    }, (subproducts, cb) => { //Recalculate subproduct composition elements cost

      subproducts.forEach((subproduct) => {

        //Calculate costs of all elements using conversion table
        subproduct.versions.composition.forEach((recipeElement) => {

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

      })
      cb(null, subproducts);

    }, (subproducts, cb) => { 

      subproducts.forEach((subproduct) =>{
        //Calculate recipe composition totals
        subproduct.versions.compositionCost=0;

        subproduct.versions.composition.forEach((element) => {
          subproduct.versions.compositionCost+=element.calculatedCost;
        })
  
        let compTotal = {
          grossWeight:0,
          netWeight:0,
          cost:0
        };
  
        subproduct.versions.composition.forEach((compElement,index2)=>{
          logger.info('Evaluating composition element %s in recipe composition.', index2);
  
          compTotal.grossWeight+=compElement.grossWeight;
          compTotal.netWeight+=compElement.netWeight;
          compTotal.cost+=compElement.calculatedCost;
  
          logger.info('Comp element gross weight is %s', compElement.grossWeight)
          logger.info('Comp element net weight is %s', compElement.netWeight);
          logger.info('Comp element calculated cost is %s', compElement.calculatedCost);
  
        }) 
        subproduct.versions.compTotals = compTotal;
      })   

      cb(null, subproducts);

    }, (subproducts, cb) => { //Get list of allergens in user language

      allergenHelper.getAllergens(userProfile, (err, aller) => {
        if (err) return cb(err)
        libraryAllergens = aller;
        logger.info('Print Books - Got allergen list')
        cb(null, subproducts)
      })

    }, (subproducts, cb) => { //populate allergens in subproducts

      subproducts.forEach((subproduct)=> {
        
        subproduct.versions.allergens.forEach((recipeAllergen) => {
          logger.info('Evaluating allergen %j', recipeAllergen);
          let subAllerId;
          if(mongoose.Types.ObjectId.isValid(recipeAllergen.allergen)){
            subAllerId = new ObjectId(recipeAllergen.allergen);
          } else {
            subAllerId = new ObjectId(recipeAllergen.allergen._id);
          }
          libraryAllergens.forEach((allergen) => {                
            let allergenId = new ObjectId(allergen._id)
            if(subAllerId.equals(allergenId)) {
              recipeAllergen.allergen=allergen;
            }
          })
        })      
        logger.info('Populated allergens in allergen array')
      })
      cb(null, subproducts);

    }, (subproducts, cb) => {

      if (mongoose.Types.ObjectId.isValid(templateId)) {

        Template.findById(templateId, (err, doc) => {
          if (err) return cb(err);
          if (!doc) {
            var err = new Error('Document not found')
            err.statusCode = 404;
            return cb(err);
          } else {
            template = doc;
            // console.log(subTemplateName,'subTemplateName')
            logger.info('Print Subproducts in Location - Got template')
            cb(null, subproducts);
          }
        })
      } else {
        var err = new Error('Invalid Object Id');
        err.statusCode = 400;
        return cb(err)
      }

    }, (subproducts, cb) => {

      let base64ImgPlaceholder = base64_encode('./templates/assets/img/img_placeholder_food.png');
      let base64ImgTexture = base64_encode('./templates/assets/img/texture.png');
      let base64ImgCircle = base64_encode('./templates/assets/img/noImageCircle.png');
      let base64logoGreen = base64_encode('./templates/assets/img/logo_green.png');
      let base64logo = base64_encode('./templates/assets/img/logo.png');
      let base64CookDesign = base64_encode('./templates/assets/img/cookdesign-logo-medium.png');
      let images = {
        imgPlaceholder: 'data:image/png;base64,' + base64ImgPlaceholder,
        imgTexture: 'data:image/png;base64,' + base64ImgTexture,
        imgCircle: 'data:image/png;base64,' + base64ImgCircle,
        imgLogo: 'data:image/jpg;base64,' + base64logoGreen,
        logo: 'data:image/png;base64,' + base64logo,
        cookDesign: 'data:image/png;base64,' + base64CookDesign
      }
      var compiled = _.template(template.template);

      logger.info('Print Subproducts in Location - Compiled template')

      let date = timeStamp();

      var location = [];

      //console.log(userProfile,'userProfile');

      i18n.setLocale(userProfile.user.language);

      html = compiled({
        elementsList: subproducts,
        images: images,
        i18n: i18n,
        date: date,
        printUser: user,
        tax: Number(tax),
        recipe: subproducts[0],
        recipeType: 'subproduct'
      });

      logger.info('Print Subproducts in Location - Generated html from template')

      cb(null, subproducts);

    }, (subproducts, cb) => {
      //console.log(subproducts,'subproducts')
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
          "height": "5mm",
          "contents": {
            first: '',
            2: '', // Any page number is working. 1-based index 
            default: '' // fallback value 
          }
        },
        "timeout": "1200000" //20 min
      }

      pdf.create(html, options).toStream(function (err, stream) {
        if (err) return cb(err);
        logger.info('Print Subproducts in Location - Created pdf')
        cb(null, stream)
      });

    }], (err, stream) => {

      if (err) return callback(err)
      callback(null, stream)

    })

}


//Function used to sort array based on name
function compare(a, b) {
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
  filteredElements = allElements.filter(element => element._id);
  if (filteredElements.length > 0) {
    filteredElements[0].init = true;
    for (var i = 0; i < filteredElements.length; i++) {
      sortedElements.push(filteredElements[i]);
    }
    //console.log(filteredElements,'filteredP')
  }

  filteredElements = [];
  return aller;

}

var breakOutStructure = (composition, menuType) => { //Assumes the composition array has been tag with the function sortedStructure

  var compArray = [];
  var tableArray = [];
  var tableObj = {};

  composition.forEach((compElement, index) => {
    //console.log(compElement.element.item.versions[0].composition,'breakOutStructure')
    if (menuType != 'catalog') compElement.element.item.versions[0].composition = sortedCategory(compElement.element.item.versions[0].composition)

    if (index == 0) { //First time around, just store compElement in compArray

      compArray.push(compElement);

    } else {

      if (compElement.familyInit || compElement.subfamilyInit) {

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
  var previousFamilyId = null;
  var previousSubfamilyId = null;
  var familyLength = 0;
  var subfamilyLength = 0;
  var previousFamilyInitIndex = 0;
  var previousSubfamilyInitIndex = 0;
  var numFamilies = 0;
  var numSubfamilies = 0;
  var subfamilyId = 0;
  var allElements = compositionArray;
  var sortedElements = [];
  var filteredElements = [];
  var length = allElements.length;
  var numFams;
  var typeFamily;
  //reset tags
  allElements.map((element) => {
    element.familyInit = false;
    element.subfamilyInit = false;
    element.subfamilyList = [];
  });

  allElements.forEach((element, index) => {
    //console.log(element,'element');
    familyLength++;
    subfamilyLength++;

    //if(element.family._id!=previousFamilyId)  {}
    let elementFamId = new ObjectId(element.family._id);
    let prevFamilyId = new ObjectId(previousFamilyId);
    if (!elementFamId.equals(prevFamilyId)) {
      //console.log('------------------starts new family-----------',element.family.lang.name);
      numFamilies++;
      element.familyInit = true;
      element.familyId = numFamilies;
      if (index > 0) {
        allElements[previousFamilyInitIndex].familyLength = familyLength - 1;
        allElements[previousFamilyInitIndex].numSubfamilies = numSubfamilies;
      }
      familyLength = 1;
      numSubfamilies = 0;
      subfamilyId = 0;
      previousFamilyId = element.family._id;
      previousFamilyInitIndex = index;

    }
    // console.log(element,'element')
    //console.log(previousSubfamilyInitIndex,'previousSubfamilyInitIndex')
    //if(element.subfamily._id!=previousSubfamilyId)  {}
    let elementSubFamId = new ObjectId(element.subfamily._id);
    let previousSubFamilyId = new ObjectId(previousSubfamilyId);
    if (!elementSubFamId.equals(previousSubFamilyId) && element.subfamily._id) {
      //console.log('------------------starts new subfamily-----------',element.subfamily.lang.name);
      numSubfamilies++;
      element.subfamilyInit = true;
      //console.log(element.subfamilyInit,'subfamilyIFinit')
      if (!(element.subfamily < 0)) subfamilyId++;
      element.subfamilyId = numFamilies + '.' + subfamilyId;
      if (index > 0) {
        allElements[previousSubfamilyInitIndex].subfamilyLength = subfamilyLength - 1;
        let obj = {
          name: element.name,
          price: element.price
        }
        allElements[index].subfamilyList.push(obj);
      }
      subfamilyLength = 1;
      previousSubfamilyId = element.subfamily._id;
      //console.log(element.subfamily,'element.subfamily')
      previousSubfamilyInitIndex = index;
    } else if (elementSubFamId.equals(previousSubFamilyId) && element.subfamily._id) {
      //console.log('------------------same subfamily-----------',element.subfamily.lang.name);
      let obj = {
        name: element.name,
        price: element.price
      }
      allElements[previousSubfamilyInitIndex].subfamilyList.push(obj);
    } else {
      let obj = {
        name: element.name,
        price: element.price
      }
      allElements[previousFamilyInitIndex].subfamilyList.push(obj);
    }

    element.numFamilies = numFamilies;
    let elementId = new ObjectId(element._id);
    let allElementsId = new ObjectId(allElements[length - 1]._id);
    if (elementId.equals(allElementsId)) {
      numFams = numFamilies;
    }

  })

  if (allElements.length > 0) {
    //Add length of last family and subfamily item
    allElements[previousFamilyInitIndex].familyLength = familyLength;
    allElements[previousFamilyInitIndex].numSubfamilies = numSubfamilies;
    allElements[previousSubfamilyInitIndex].subfamilyLength = subfamilyLength;
  }

  //console.log('allElementes sort structure --->', allElements);
  allElements.forEach((element, index) => {
    if (element.subfamilyList.length > 0) {
      //console.log('index',index);
      //console.log('for',element.name);
      //console.log(' have this subfamilyList--> ',element.subfamilyList)
    }
  })
  return allElements;
}

var setSubfamilyId = (compositionArray, families) => {

  //Sets a 'bogus' subfamily id to dishes with null subfamily id. The 'bogus' id is negative and common for 
  //dishes within the same family. This 'bogus' id is used to group by subfamily all dishes with null subfamily within family.
  //When saving the menu composition, negative subfamily ids are reset to null.

  //console.log(this.menu.composition, 'dish composition list before filtering')

  //Filter dishes with subfamily null
  var elementsWithSubfamilyNull = compositionArray.filter((element) => {
    return element.subfamily == null;
  })

  //Set subfamily id based on position of family in families array
  elementsWithSubfamilyNull.forEach((element) => {
    //console.log(element,'elementSubfamilyNull')
    var familyIndex;

    //get index of family in families array. There has to be a match, the alternative is not possible if 
    //referential integrity is working corectly.
    families.find((family, index) => {
      //if(element.family._id == family._id) familyIndex=index;
      let famId = new ObjectId(family._id)
      let elementFamId = element.family._id
      if (famId.equals(elementFamId._id)) {
        familyIndex = index
      }
    })

    //console.log(familyIndex, 'family index position')

    //Set id based on family index. 
    // Same method is used when adding/editing a dish without subfamily and setting a (bogus) id.
    element.subfamily = {
      _id: -(familyIndex + 1),
      lang: {
        name: 'none'
      }
    }
  })
  return compositionArray;
}

exports.download = (uri, filename, callback) => {
  request.head(uri, function (err, res, body) {
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
  var date = [now.getDate(), now.getMonth() + 1, now.getFullYear()];

  // Create an array with the current hour, minute and second
  var time = [now.getHours(), now.getMinutes(), now.getSeconds()];

  // Determine AM or PM suffix based on the hour
  var suffix = (time[0] < 12) ? "AM" : "PM";

  // Convert hour from military time
  time[0] = (time[0] < 12) ? time[0] : time[0] - 12;

  // If hour is 0, set it to 12
  time[0] = time[0] || 12;

  // If seconds and minutes are less than 10, add a zero
  for (var i = 1; i < 3; i++) {
    if (time[i] < 10) {
      time[i] = "0" + time[i];
    }
  }

  // Return the formatted string
  return date.join("/") + " " + time.join(":") + " " + suffix;
}

var removeDuplicatesAllergens = (arr) => {

  var i, j, cur, curLvl, found;
  for (i = arr.length - 1; i >= 0; i--) {
    cur = new ObjectId(arr[i].allergen._id);
    curLvl = arr[i].level;
    found = false;
    for (j = i - 1; !found && j >= 0; j--) {
      let id = new ObjectId(arr[j].allergen._id);
      let idLvl = arr[j].level;
      if (cur.equals(id)) {
        //console.log(cur,'matchIds',id)
        if (i != j && curLvl == idLvl) {
          //console.log('same Level')
          arr.splice(i, 1);
        } else if (i != j && curLvl != idLvl) {
          if (curLvl < idLvl) {
            //console.log('j>i')
            arr.splice(i, 1);
          } else {
            //console.log('j<i')
            arr.splice(j, 1);
          }
        }
        found = true;
      }
      //console.log(cur,'not match with id',id)
    }
  }
  // console.log(arr.length,'arrayRemoveDuplicates.length')
  // console.log(arr,'arrayRemoveDuplicates')
  return arr;
}

var sortedCategory = (compositionArray) => {
  logger.info('sortedCategory - Entering method')
  var allElements = compositionArray;
  var sortedElements = [];
  var filteredElements = [];

  allElements = allElements.map((element) => {
    let object = {
      locationCost: element.locationCost,
      equivalenceUnit: element.equivalenceUnit,
      element: element.element,
      allergens: element.allergens,
      category: element.category,
      calculatedCost: element.calculatedCost,
      unitCost: element.unitCost,
      name: element.name,
      baseUnitShortName: element.baseUnitShortName,
      baseUnit: element.baseUnit,
      measuringUnit: element.measuringUnit,
      measuringUnitShortName: element.measuringUnitShortName,
      _id: element._id,
      wastePercentage: element.wastePercentage,
      grossWeight: element.grossWeight,
      createdAt: element.createdAt,
      updatedAt: element.updatedAt,
      init: false
    }

    return object;
  })

  filteredElements = allElements.filter(element => element.category == 'mainProduct');
  if (filteredElements.length > 0) {
    filteredElements[0].init = true;
    logger.info('SortedCategory - setting .init=true for mainProduct on element %j', filteredElements[0].name)
    for (var i = 0; i < filteredElements.length; i++) {
      sortedElements.push(filteredElements[i]);
    }
    //console.log(filteredElements,'filteredP')
  }

  filteredElements = [];

  filteredElements = allElements.filter(element => element.category == 'dressing');
  if (filteredElements.length > 0) {
    filteredElements[0].init = true;
    logger.info('SortedCategory - setting .init=true for dressing on element %j', filteredElements[0].name)
    for (var i = 0; i < filteredElements.length; i++) {
      sortedElements.push(filteredElements[i]);
    }
    //console.log(filteredElements,'filteredD')
  }

  filteredElements = [];

  filteredElements = allElements.filter(element => element.category == 'sauce');
  if (filteredElements.length > 0) {
    filteredElements[0].init = true;
    logger.info('SortedCategory - setting .init=true for sauce on element %j', filteredElements[0].name)
    for (var i = 0; i < filteredElements.length; i++) {
      sortedElements.push(filteredElements[i]);
    }
    //console.log(filteredElements,'filteredS')
  }

  filteredElements = [];

  filteredElements = allElements.filter(element => element.category == 'addition');
  if (filteredElements.length > 0) {
    filteredElements[0].init = true;
    logger.info('SortedCategory - setting .init=true for addition on element %j', filteredElements[0].name)
    for (var i = 0; i < filteredElements.length; i++) {
      sortedElements.push(filteredElements[i]);
    }
    //console.log(filteredElements,'filteredA')
  }
  //logger.info({sortedElements: sortedElements},'sortedCategory - return sortedElements')
  return sortedElements;
}