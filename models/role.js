"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.schema;
var config = require('./../config/config');
var uniqueValidator = require('mongoose-unique-validator');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');

//Definign schema
var roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        maxLength: 25
    },
    entities: [{
        name: {
            type: String,
            //enum: config.entities.name,
        },
        permissions: {
            read: Boolean, //GET
            edit: Boolean, //PUT //POST //PATCH
            delete: Boolean  //DELETE
        }
    }]
}, {
    timestamps: true
});


roleSchema.plugin(uniqueValidator);

roleSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});

/***************** Pre remove *********************/
roleSchema.pre('remove', function (next) {
  var role = this; //this is the document being removed
  var Role = this.constructor;  //this.constructor is the model
  var roleId = new ObjectId(role._id);
  var Account = require('./account')

  waterfall([
    (cb) => {
        //Check whether any account is using this role
        Account.find({role: roleId}, (err, doc) => {
            if (err) return cb(err);
            if(doc.length) { //
                var err = new Error('At least one account is currently using this role.');
                err.statusCode = 400;
                return cb(err)
            } else {
                // var err = new Error('Bogus error.');
                // err.statusCode = 400;
                // cb(err)
                cb(null, doc)
            }
        })        
    }], (err, ok) => {
        if (err) return next(err);
        next();
    })   
})

//creating model
var model = mongoose.model('role', roleSchema);
module.exports = model;