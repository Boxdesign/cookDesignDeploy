var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var contactSchema = new Schema({
 	name: {
		type: String,
		uppercase: true
	},
 	job: {
		type: String,
		uppercase: true
	},
 	email: {
		type: String,
		uppercase: true
	},
 	phone: {
		type: String,
		uppercase: true
	} 	
 },
 {
 	timestamps: true
 });

//create model
var model = mongoose.model('contact', contactSchema);
module.exports = model;