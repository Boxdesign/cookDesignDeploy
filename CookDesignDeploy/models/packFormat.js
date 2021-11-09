"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('./../helpers/restrict');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.packFormatHooks;


//Definign schema
var packFormatSchema = new Schema({
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
        description: {
            type: String,
            required: false
        }
    }],
    referenceNumber:{
        type:String,
        required:false,
        unique:false
    },
    gallery: {
        type: Schema.Types.ObjectId,
        ref: 'gallery',
        required: false
    },
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

packFormatSchema.statics.findDeps = (packagingId, cb) => {
    restrict(cb, packagingId, 'packFormat', []);
};

packFormatSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});


/***************** Post save *********************/
packFormatSchema.post('save', function (doc, next) {
  var removeImageQueue = require('../queues/removeImage')

  logger.info('Pack-format post-save hook - Entering user post save hook.')

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
            logger.info('Pack-format post-save hook - Image has been deleted')
            deleteImage = true;
        } 
        else if(this._original.gallery !=null && this.gallery != null)
        {
            let galleryId = new ObjectId(this.gallery)
            let originalGalleryId = new ObjectId(this._original.gallery)
            
            if(!galleryId.equals(originalGalleryId)) {
                logger.info('Pack-format post-save hook - Image has changed')
                deleteImage=true;
            }
            else
            {
                logger.info('Pack-format post-save hook - Image has not changed')
            }
        }
        else
        {
            logger.info('Pack-format post-save hook - No image added or one has been added')
        }

        if(process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

      removeImageQueue.removeImage(
        {
          title: 'Pack-format post-save hook - Remove image',
          id: this._original.gallery, 
        }
      );            
        }

        cb(null, true)

    }], (err, doc) => {
        if(err) return next(err);
        this._original = this.toJSON();
        logger.info('Pack-format post-save hook - Finished user post-save.')
        next();
  })
});

//creating model
var model = mongoose.model('packFormat', packFormatSchema);
module.exports = model;