
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var pricingRateSchema = new Schema({
 	name: {
 		type: String,
 		required: false,
 		min: 0
 	},
 	costOverPricePercentage: {
 		type: Number,
 		required: false,
 		min: 0
 	},
 	price: {
 		type: Number,
 		required: false,
 		min: 0
 	},
 	active:{
 		type: Boolean,
 		required: false
 	}
 },
 {
 	timestamps: true
 });

//create model
var model = mongoose.model('pricingRate', pricingRateSchema);
module.exports = model;