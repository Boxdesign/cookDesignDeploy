'use strict';

var waterfall = require('async-waterfall');
var s3Uploader = require('../helpers/s3_uploader');
var Gallery = require('../models/gallery');
var gm = require('gm').subClass({ imageMagick: true });
var config = require('./../config/config');
var {ObjectId} = require('mongodb');
var Gallery = require('../models/gallery');
var galleryHelper = require('../helpers/gallery');

/**
* @api {post} /gallery Add new imageCircle to the gallery
* @apiGroup {gallery}
* @apiName Add image
*
* @apiDescription This endpoint allow the web app and related services to upload a new image to the gallery
 *  When uploaded, it will return the gallery object with the different sizes and their URLS.
*
* @ApiHeader (Security) {String}  Authorization Auth Token
*
*
* @apiSuccess {Object} Field name  short desc
* @apiError Not Found Object field description
*
* @apiVersion 0.1.0
*
*/

exports.uploadImage = (req, res) => {

		let folderPath = req.body.folderPath || null;

    waterfall([

      (cb) => {

         galleryHelper.generateCircleImage(req,(err,imgObjCircle)=>{
              if (err) return cb(err)
              cb(null,imgObjCircle)
         })

      }, (imgObjCircle, cb) => {

          //En esta parte, cargaremos la imagen en el bucket.
          let imgObject = req.file;
          //imgObject.entity = 'allergen';
          s3Uploader.resizeAndUpload(imgObject,imgObjCircle, folderPath, cb)

      }, (galleryObj, cb) => {

       cb(null, galleryObj);

      }], (err, ok) => {
  				if(err) return res.status(500).json(err.message || 'Error').end();
          return res.json(ok)
      });
};


/**
* @api {get} /gallery Get gallery 
* @apiGroup {gallery}
* @apiName Get gallery
*
* @apiDescription This endpoint allow the web app and related services to get an image from its id.
*
* @ApiHeader (Security) {String}  gallery id
*
* @apiSuccess {Object} Field name  short desc
* @apiError Not Found Object field description
*
* @apiVersion 0.1.0
*
*/
exports.get = (req, res) => {

    let params = req.query;
    let galleryId = new ObjectId(params._id);

    waterfall([
        (cb) => {
            Gallery.findById(galleryId, (err, doc) => {
                if (err) return cb(err)
                if (!doc) {
                    let err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err)
                }
                cb(null, doc)
            })

        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            return res.status(200).json(ok)
        });
};


/*
 
 Checks all gallery documents in Gallery collection. If gallery document is not being used, it deletes it from Gallery collection and Amazon S3

*/

exports.deleteGalleryDocsNotUsed = (req, res) => {
  var async = require('async');
  var galleries;
  var galleryCount = 0;
  var totalNumGallery;
  var Allergen = require('../models/allergen');
  var Ingredient = require('../models/ingredient');
  var Location = require('../models/location');
  var Packaging = require('../models/packaging');
  var PackFormat = require('../models/packFormat');
  var User = require('../models/user');
  var Utensil = require('../models/utensil');
  var CookingSteps = require('../models/cookingSteps');
  var Process = require('../models/process');
  var Dish = require('../models/dish');
  var Drink = require('../models/drinks');
  var Subproduct = require('../models/subproduct');
  var Product = require('../models/product');
  let countingAllergen = 0;
  let countingIngredient = 0;
  let countingLocation = 0;
  let countingPackaging = 0;
  let countingPackFormat = 0;
  let countingUser = 0;
  let countingUtensil = 0;
  let countingCookingSteps = 0;
  let countingProcess = 0;
  let countingDrink = 0;
  let countingDish = 0;
  let countingProduct = 0;
  let countingSubproduct = 0;
  let Models1 = [Allergen,Ingredient,Location,Packaging,PackFormat,User, Utensil];
  let Model2 = [CookingSteps, Process];
  let Model3 = [Drink, Dish, Subproduct, Product];
  let mongoose = require('../node_modules/mongoose');
  let removed = 0
  let key;
  let indexof;

  var AWS = require('aws-sdk');

  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;


  waterfall([
  (cb) => {
    Gallery.count({}, (err, count) => {
      if(err) return cb(err)
      totalNumGallery = count;
      console.log(totalNumGallery, 'totalNumGallery')
      cb(null, true)
    })
  }, (docs, cb) => {
    async.during(
    (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
      return callback(null, galleryCount < totalNumGallery);
    },
    (callback) => {
      Gallery
      .findOne({})
      .skip(galleryCount)
      .limit(1)
      .exec((err, gallery) => {
        if(err) callback(err)
        galleryCount ++
        
        async.waterfall([
        (cb_gallery)=>{ //Check whether Gallery is being used in Models1 array
          let removeDoc = true;

          async.eachSeries(Models1, function(Model1,cb_async){          
            Model1.find({gallery: gallery._id},{_id:1}, (err, doc) => {
              if (doc && doc.length) {
               
                removeDoc = false;
                if(Model1==Allergen) countingAllergen ++
                if(Model1==Ingredient) countingIngredient ++
                if(Model1==Location) countingLocation ++
                if(Model1==Packaging) countingPackaging ++
                if(Model1==PackFormat) countingPackFormat ++
                if(Model1==User) countingUser ++
                if(Model1==Utensil) countingUtensil ++ 
                cb_gallery(null, removeDoc)
                
              } else {              
                cb_async(null, doc)              
              }              
            })
          },(err,gallery)=> {
            if(err) return cb_gallery(err)
            cb_gallery(null, removeDoc)
          })
        },(removeDoc,cb_gallery)=>{ //Check whether Gallery is being used in Models1 array

          if (!removeDoc) return cb_gallery(null, removeDoc)
          async.eachSeries(Model2, function(Model2,cb_async){            
            Model2.find({images: gallery._id},{_id:1}, (err, doc) => {
              if (doc && doc.length) {

                removeDoc = false;
                if(Models1==CookingSteps) countingCookingSteps ++
                if(Models1==Process) countingProcess ++

                cb_gallery(null, removeDoc)

              } else {
                cb_async(null, doc)
              }
            });            
          },(err,doc) =>{

            if(err) return cb_gallery(err)
            cb_gallery(null, removeDoc)            
          })
        },(removeDoc,cb_gallery)=>{
          
          if (!removeDoc) return cb_gallery(null, removeDoc)
          async.eachSeries(Model3, function(Model3,cb_async){                   
            Model3.find({"versions.gallery": gallery._id}, (err, doc) => {
             if (doc && doc.length) {

              removeDoc = false;
              if(Model3==Dish) countingDish ++
              if(Model3==Drink) countingDrink ++
              if(Model3==Subproduct) countingSubproduct ++
              if(Model3==Product) countingProduct ++
              
              cb_gallery(null, removeDoc)

            } else {
              cb_async(null, doc)
            }
          });
        },(err) =>{
          if(err) return callback(err)

          if(err) return cb_gallery(err)
          cb_gallery(null, removeDoc)
        })
        
      },(removeDoc,cb_gallery)=>{
        console.log('gallery ', galleryCount, ' of a total of ', totalNumGallery)

        if (removeDoc){
          gallery.remove((err,doc) => { //Delete from Gallery collection
          	if(err) return callback(err)
            async.each(doc.sizes, (size, cb_async)=>{ //Delet from S3
              indexof = size.url.indexOf(config.awsBucket.bucketName)
              if (indexof > 0) {
                key = size.url.substring(indexof).replace(config.awsBucket.bucketName+'/','')
                var params = {
                  Bucket: config.awsBucket.bucketName,
                  Key: key
                };
                var s3 = new AWS.S3;
                s3.deleteObject(params, function(err, data) {
                  if (err) return cb_async(err)
                  cb_async()
                });
              } else process.nextTick(()=>cb_async())
            }, (err) => {
            	if(err) return callback(err)
	            removed ++
	            galleryCount --
	            totalNumGallery --
	            callback(null, true)            	
            })
          })
        } else { //Gallery object is being used. Do not remove, but remove old sizes.
          if (gallery.sizes.length == 5) {
            gallery.sizes.splice(1,3)
            gallery.save((err) => {
              if (err) return callback(err)
              callback(null, true)
            });
          } else callback(null, true)
        }
      }],(err, ok)=>{
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
      })
        
    },(err,doc) =>{
      if(err) return callback(err)      
    })
  }, (err) => { // Finished looping through all ingredients
    if(err) return cb(err)
    console.log(countingAllergen, 'countingAllergen')
    console.log(countingIngredient, 'countingIngredient')
    console.log(countingLocation, 'countingLocation')
    console.log(countingPackaging, 'countingPackaging')
    console.log(countingPackFormat, 'countingPackFormat')
    console.log(countingUser, 'countingUser')
    console.log(countingUtensil, 'countingUtensil')
    console.log(countingProcess, 'countingProcess')
    console.log(countingCookingSteps, 'countingCookingSteps')
    console.log(countingDrink, 'countingDrink')
    console.log(countingDish, 'countingDish')
    console.log(countingProduct, 'countingProduct')
    console.log(countingSubproduct, 'countingSubproduct')
    console.log(removed, 'removed')
    console.log(totalNumGallery, 'totalNumGallery')
    cb(null, true)
  })
}], (err, ok) => {
    if(err) return res.status(500).json(err.message || 'Error').end();
    res.status(200).json(ok).end();
  })
};
