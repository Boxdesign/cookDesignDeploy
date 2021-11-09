"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');

//Definign schema
var accountSchema = new Schema({
        name: {
            type: String,
            uppercase: true,
            required: true
        },
        active: {
            type: Boolean,
            default: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'user',
            required: true
        },
        role: {
            type: Schema.Types.ObjectId,
            ref: 'role',
            required: true
        },
        deleted: {
            type: Boolean,
            default: false
        },
        location: [{
            type: Schema.Types.ObjectId, 
            ref: 'location',
            required: true
        }],
        socket: String,
        checkLocOnLogin: {
            type: Boolean,
            required: true,
            default:false
        }
    },
    {
        timestamps: true
    });

accountSchema.plugin(uniqueValidator);

accountSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});

/***************** Pre remove *********************/
accountSchema.pre('remove', function (next) {
  var account = this; //this is the document being removed
  var Account = this.constructor;  //this.constructor is the model
  var accountId = new ObjectId(account._id);

  waterfall([
    (cb) => {
         cb(null, true)  //when deleting an account, the system simply sets the deleted flag to true, 
                        // but does not remove the account from the database

    }], (err, ok) => {
        if (err) return next(err);
        next();
    })   
})

//creating model
var model = mongoose.model('account', accountSchema);
module.exports = model;
