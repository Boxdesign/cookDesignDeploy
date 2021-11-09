"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var async = require('async')
var {ObjectId} = require('mongodb');
var restrict = require('../helpers/restrict');
var enums = require('../config/dbEnums');
var waterfall = require('async-waterfall');
//var workRoomSchema = require('mongoose').model('workRoom').schema;

var workRoomSchema = new Schema({

    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: false,
        }
    }],
    referenceNumber : {
        type:String,
        required: false,
        unique: false
    }

}, {
    timestamps: true
});

var kitchenSchema = new Schema({

    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: false,
        }
    }],
    referenceNumber : {
        type:String,
        required: false,
        unique: false
    },
    workRooms : [
      workRoomSchema
    ],
		location: [{
			type: Schema.Types.ObjectId, 
			ref: 'location',
			required: true
		}]
}, {
    timestamps: true
});
/***************** Pre remove *********************/
kitchenSchema.pre('remove', function(next) {
    var kit = this;
    var kitId = new ObjectId(kit._id);
    var restrict = require('../helpers/kitchenRestrict');

    waterfall([
    (cb) => {
        //Verify that there aren't any models that contain this kitchen
        restrict.kitchenRestrict(kitId, function(err, matches){
            if(err) return cb(err)
            	
            if (matches.length>0) {
                var err=new Error('Family can not be removed because it is being used.');
                err.statusCode=400;
                return cb(err);
            }
            cb(null, matches);
            // var err=new Error('Bogus error.');
            //     err.statusCode=400;
            //     cb(err); 
        })
    }], (err, ok) => {
        if (err) { 
            return next(err);
        }
        next();
        
    })   

})

//creating model
var model = mongoose.model('kitchen', kitchenSchema);
module.exports = model;