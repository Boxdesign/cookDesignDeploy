var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var enums = require('../config/dbEnums');

var selentaAllergensSchema = new Schema({
	ZCEREALES_GLUT: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZCRUSTACEOS: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZHUEVOS: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZPESCADOS: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZCACAHUETES: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZSOJA: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZLACTEOS: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZFRUTOS_SEC: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZAPIO: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZMOSTAZA: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZSESAMO: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZSULFITOS: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZALTRAMUCES: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	ZMOLUSCOS: {
		type: String,
		enum: enums.selentaAllergenLevels
	},
	Z0MG: {
		type: String,
		enum: enums.selentaAllergenLevels
	}
},
{
	timestamps: true
});

var selentaAlternativeMeasUnitSchema = new Schema({
 	UMREN: { //altMeasUnitDenominator - 1 
		type: String
	},
 	MEINH: { //alternativeMeasUnit - "Box" 
		type: String
	},
 	UMREZ: { //conversionValue - 168 
		type: String
	},
 	MEINS: { //baseMeasUnit - "Unit" => 1 Box contains 168 Units 
		type: String 
	}	
},
{
	timestamps: true
});

var selentaProviderSchema = new Schema({
	IDNLF: { // article reference
		type: String
	},
 	LIFNR: { // providerCode
		type: String
	},
 	NAME1: {  // name
		type: String
	},
	DMBTR: {  // Cost
		type: String
	},
	BLDAT: {  // Date last delivery
		type: String
	},
	ERFMG: {  // Quantity
		type: String
	},
	ERFME: {  // Delivery unit
		type: String
	},
	LOEVM: {  // Active/Inactive
		type: String
	},
	STCD1: {  // N.I.F
		type: String
	}
},
{
	timestamps: true
});


var selentaArticleSchema = new Schema({
 	MATNR: { // codeSAP
		type: String 
	},
 	MAKTX: { // name
		type: String
	},
 	MTART: { // typeOfMaterial
		type: String
	},
	MSEH3: { // baseMeasUnit
		type: String
	},
	MATKL: { // family
		type: String
	},
	PROVIDER: [ // provider
		selentaProviderSchema
	],
	UMA: [ //  alternativeMeasUnit
		selentaAlternativeMeasUnitSchema
	],
	ALERGENOS: [
		selentaAllergensSchema
	],
	cookDesignId : { // ArticleId
		type: String
	},
	updatedDate : {
   	type: Date		
	},
	costWarning: {
		type: Boolean,
		default: false
	}
},
{
	timestamps: true
});

var selentaFamilySchema = new Schema({
	
	GRUP_ARTICLES: {
		type: String
	},
	DESCRIPCIO: {
		type: String
	},
	type:{
		type: String
	},
	familyId: {
		type: String
	},
	subfamilyId: {
		type: String
	},
	externalCode:{
		type: String
	}
},
{
	timestamps: true
})

var selentaSchema = new Schema({
 	issue: {
 		type: {
 			type: String	
 		},
		description: {
			type: String
		}
	},
 	provider: [
		selentaProviderSchema
	],
	article: [
		selentaArticleSchema
	],
	family: [
		selentaFamilySchema
	]
 },
 {
 	timestamps: true
 });

//create model
var model = mongoose.model('selenta', selentaSchema);
module.exports = model;