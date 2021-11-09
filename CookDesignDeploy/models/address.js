var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var addressSchema = new Schema({
 	street: {
		type: String,
		uppercase: true
	},
 	postalCode: {
		type: String,
		uppercase: true
	},
 	city: {
		type: String,
		uppercase: true
	},
 	state: {
		type: String,
		uppercase: true
	},
 	country: {
		type: String,
		uppercase: true
	} 	
 },
 {
 	timestamps: true
 });


//create model
var model = mongoose.model('address', addressSchema);
module.exports = model;