"use strict";

var config = require('../config/config');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');
var assert = require('assert');
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.userHooks;



//Encrypt password
function ncrypt(pwd) {
        return crypto.createHash('sha256').update(pwd + '-' + config.secret).digest('base64');
};


//Defining schema
var userSchema = new Schema({
    email: {
        type: String,
        required: false,
        uppercase: true
    },
    password: {
        type: String,
        set: (password) => {
            return ncrypt(password)
        },
        get: () => {
            return undefined;
        },
        required: false
    },
    firstName: {
        type: String,
        uppercase: true
    },
    lastName: {
        type: String,
        uppercase: true
    },
    language: {
        type: String,
        default: 'es'
    },
    gallery: {
        type: Schema.Types.ObjectId,
        ref: 'gallery',
        required: false
    },
    active: {
            type: Boolean,
            default: true
    },
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: false
    },
    deleted: {
            type: Boolean,
            default: false
    },
}, {
     timestamps: true
});

userSchema.set('toJSON', {getters: true, virtuals: false});

userSchema.statics.doLogin = (email, password, cb) => {
    let ncryptPwd = ncrypt(password);
    model.findOne(
        {   
            'email': {$regex: email, $options: 'i'}, 
            'password': ncryptPwd
        }, 
        'email deleted active',
        (err, user)=> {
            if(err) cb(err)
            if(!user){ 
                cb(err) 
            } else if(user.deleted || !user.active) {
                cb('User deleted or not active');
            } else {
                cb(null, user);
            }
        });
};
/****************  HOOKS  ***************************/

/***************** Post init *********************/
userSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});


userSchema.post('save', function (doc, next) {
  var removeImageQueue = require('../queues/removeImage')

  logger.info('Ingredient post-save hook - Entering user post save hook.')

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
            logger.info('Ingredient post-save hook - Image has been deleted')
            deleteImage = true;
        } 
        else if(this._original.gallery !=null && this.gallery != null)
        {
            let galleryId = new ObjectId(this.gallery)
            let originalGalleryId = new ObjectId(this._original.gallery)
            
            if(!galleryId.equals(originalGalleryId)) {
                logger.info('Ingredient post-save hook - Image has changed')
                deleteImage=true;
            }
            else
            {
                logger.info('Ingredient post-save hook - Image has not changed')
            }
        }
        else
        {
            logger.info('Ingredient post-save hook - No image added or one has been added')
        }

        if(process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

      removeImageQueue.removeImage(
        {
          title: 'Ingredient post-save hook - Remove image',
          id: this._original.gallery, 
        }
      );            
        }

        cb(null, true)

    }], (err, doc) => {
        if(err) return next(err);
        this._original = this.toJSON();
        logger.info('Ingredient post-save hook - Finished user post-save.')
        next();
  })
});
var model = mongoose.model('user', userSchema);
module.exports = model;
