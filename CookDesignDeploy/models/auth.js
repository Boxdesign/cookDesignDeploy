"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Account = require('./account');

//Definign schema
var authSchema = new Schema({
    token: String,
    socket: String,
    user: { //No tiene que estar referenciado a una usuario, si no a su cuenta
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    account: {
        type: Schema.Types.ObjectId,
        ref: 'account'
    },
    exp: Date,
}, {
    timestamps: true
});

//Validator
authSchema.path('account').validate(function (value, respond) {

    Account.findOne({_id: value}, function (err, doc) {
        if (err || !doc) {
            respond(false);
        } else {
            respond(true);
        }
    });

}, 'Example non existent');

//creating model
var model = mongoose.model('auth', authSchema);
module.exports = model;