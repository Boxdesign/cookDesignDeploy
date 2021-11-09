"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('../helpers/restrict');
var enums = require('../config/dbEnums');
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');

var subfamiliesSchema = new Schema({
    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
        }
    }],
    referenceNumber:{
        type:String
    },
    externalCode: { //Used for mapping families with other systems (SAP, etc.)
        type:String
    }
}, {
    timestamps: true
});

//Definign schema
var familySchema = new Schema({
    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true
        }
    }],
    category: {
        type: String,
        required: true,
        enum: enums.families
    },
    referenceNumber:{
        type:String
    },
    externalCode: { //Used for mapping families with other systems (SAP, etc.)
        type:String
    },
    subfamilies: [
        subfamiliesSchema
    ],
    externalFamily: Boolean,
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: true
    },
		location: [{
			type: Schema.Types.ObjectId, 
			ref: 'location',
			required: true
		}],
    assigned_location: {
        type: Schema.Types.ObjectId,
        ref: 'location',
        required: false
    }
}, {
    timestamps: true
});

// familySchema.statics.findDeps = (id, field, cb) => {
//     restrict(cb, id, field, [Ingredient, Utensil, Packaging]);
// };

/***************** Pre remove *********************/
familySchema.pre('remove', function(next) {
    var fam = this;
    var famId = new ObjectId(fam._id);
    var restrict = require('../helpers/familyRestrict');

    waterfall([
    (cb) => {
        //Verify that there aren't any models that contain this family
        restrict.familyRestrict(famId, function(err, matches){
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
var model = mongoose.model('family', familySchema);
module.exports = model;