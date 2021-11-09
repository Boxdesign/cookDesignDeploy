"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');
var enums = require('../config/dbEnums');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.utensilHooks;

//Definign schema
var utensilSchema = new Schema({
    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
            unique: true
        },
        accessories: {
            type: String,
        }
    }],
    referenceNumber:{
        type:String,
        required:false,
        unique:false
    },
    family: {
        type: Schema.Types.ObjectId,
        ref: 'family',
        required: false
    },
    subfamily: {
        type: Schema.Types.ObjectId,
        ref: 'family.subfamilies',
        required: false
    },
    externalFamily: {
        type: Schema.Types.ObjectId,
        ref: 'family',
        required: false
    },
    externalSubfamily: {
        type: Schema.Types.ObjectId,
        ref: 'family.subfamilies',
        required: false
    },
    gallery : {
        type: Schema.Types.ObjectId,
        ref: 'gallery',
        required: false
    },
    provider : {
        type: Schema.Types.ObjectId,
        ref: 'provider',
        required: false
    },
    externalLink: Boolean,
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: true
    },
    assigned_location: {
        type: Schema.Types.ObjectId,
        ref: 'location',
        required: false
    }
}, {
    timestamps: true
});


utensilSchema.index({ "lang.name": "text" }, {default_language: "spanish"});

/***************** Pre remove *********************/
utensilSchema.pre('remove',function(next) {
    var utensil = this;       //this is the document being removed
    var Utensil = this.constructor;    //this.constructor is the model
    var Subproduct = require('mongoose').model('subproduct');
    var Dish = require('mongoose').model('dish');
    var Product = require('mongoose').model('product');
    var utensilId = new ObjectId(utensil._id);

    waterfall([
    (cb) => {
        //Verify that there aren't any subproduct versions that contain this subproduct
        Subproduct.aggregate([
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.utensil': utensilId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('Utensil cannot be removed because it is used in a least of cookingSteps of one subproduct');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb) => {
        //Verify that there aren't any dish versions that contain this subproduct
        Dish.aggregate([
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.utensil': utensilId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('Utensil cannot be removed because it is used in a least of cookingSteps of one dish');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb)=> {
          //Verify that there aren't any product versions that contain this subproduct
          Product.aggregate([
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.utensil': utensilId}}
          ], (err, docs) => {
                if (err) return cb(err);
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                  var err = new Error('Utensil cannot be removed because it is used in a least of cookingSteps of one product');
                  err.statusCode = 400;
                  return cb(err);
                } else {
                   cb(null, true);
                }            
          })
    }], (err, ok) => {
        // var error = new Error('Forced error');
        // error.statusCode = 400;
        if (err) { 
            return next(err);
        }
        next();
    })   
})

utensilSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});


/***************** Post save *********************/
utensilSchema.post('save', function (doc, next) {
  var removeImageQueue = require('../queues/removeImage')

  logger.info('Utensil post-save hook - Entering user post save hook.')

  waterfall([
    (cb) => {

    if(this._original) { //Edit
        cb(null, true)
        } else { //New ingredient creation. Nothing else to do, move on
            return next();
        }

    }, (ok, cb) => {

        let deleteImage = false;

        if(this._original.gallery !=null && this.gallery == null) 
        {
            logger.info('Utensil post-save hook - Image has been deleted')
            deleteImage = true;
        } 
        else if(this._original.gallery !=null && this.gallery != null)
        {
            let galleryId = new ObjectId(this.gallery)
            let originalGalleryId = new ObjectId(this._original.gallery)
            
            if(!galleryId.equals(originalGalleryId)) {
                logger.info('Utensil post-save hook - Image has changed')
                deleteImage=true;
            }
            else
            {
                logger.info('Utensil post-save hook - Image has not changed')
            }
        }
        else
        {
            logger.info('Utensil post-save hook - No image added or one has been added')
        }

        if(process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

      removeImageQueue.removeImage(
        {
          title: 'Utensil post-save hook - Remove image',
          id: this._original.gallery, 
        }
      );            
        }

        cb(null, true)

    }], (err, doc) => {
        if(err) return next(err);
        this._original = this.toJSON();
        logger.info('Utensil post-save hook - Finished user post-save.')
        next();
  })
});


//creating model
var model = mongoose.model('utensil', utensilSchema);
module.exports = model;