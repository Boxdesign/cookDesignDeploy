"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const enums = require('../config/dbEnums');
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.locationHooks;


//Definign schema
var locationSchema = new Schema({
        name: String,
        active: {
            type: Boolean,
            default: false
        },
        parent_organization: { //Siempre sera el mismo? //Pero es necesario
            type: Schema.Types.ObjectId,
            ref: 'location'
        },
        parent_company: {
            type: Schema.Types.ObjectId,
            ref: 'location'
        },
        creator: {
            type: Schema.Types.ObjectId,
            ref: 'account'
        },
        gallery: {
           type: Schema.Types.ObjectId,
           ref: 'gallery',
           required: false
        },
        location_type: {
            type: String,
            enum: enums.location_types,
            required: true
        },
        referenceNumber : {
            type:String,
            required:false,
            unique:false
        },
        lang: [{
            langCode: {
                type: String,
                maxlength: 3,
                required: true
            },
            description: {
                type: String || null,
                required: false,
            }
        }],
    },
    {
        timestamps: true
    });

locationSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});

/***************** Post save *********************/
locationSchema.post('save', function (doc, next) {
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


/***************** Pre remove *********************/
locationSchema.pre('remove', function (next) {
  var location = this; //this is the document being removed
  var Location = this.constructor;  //this.constructor is the model
  var locationId = new ObjectId(location._id);
  var restrict = require('../helpers/locationRestrict')

  waterfall([
    (cb) => {
        //Check whether location is being used
        restrict.locationRestrict(locationId, (err, matches) => {
            if(err) return cb(err)
            if(matches && matches.length>0) {
                let err = new Error('Location is currently being used.')
                err.statusCode = 400;
                return cb(err)
            } else {
                // let err = new Error('Bogus error.')
                // err.statusCode = 400;
                // return cb(err)
                cb(null, true)
            }
        })

    }], (err, ok) => {
        if (err) return next(err);
        next();
    })   
})

//creating model
var model = mongoose.model('location', locationSchema);
module.exports = model;