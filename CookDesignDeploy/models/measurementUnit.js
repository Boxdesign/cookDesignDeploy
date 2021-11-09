"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('../helpers/restrict');
//var Ingredient = require('./ingredient');
var db_enums = require('../config/dbEnums');
var {ObjectId} = require('mongodb');

//Definign schema
var measurementUnitSchema = new Schema({
    lang: [{
        langCode: {
            type: String,
                maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
            unique: true
        },
        shortName: {
            type: String,
            required: true,
        },
    }],
    parentUnits: [{  //Reference to one or more base units, with conversion quantities.
        unit: {
            type: Schema.Types.ObjectId,
            ref: 'measurementUnit',
            required: false
        },
        quantity: {
            type: Number,
            required: false
        }
    }],
    base: {  //Indicates whether the measuring unit is a base unit. List of base units is listed in db_enums.base_units
        type: String,
        enum: db_enums.base_units,
        required: false,
        default: null
    },
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: false
    },
    referenceCode : {
        type: String,
        required: false
    }
}, {
    timestamps: true
});


//Hooks
measurementUnitSchema.statics.findDeps = (muId, cb) => {
    //restrict(cb, muId, 'measurementUnit', []);
};

measurementUnitSchema.index( { "$**": "text" }, { default_language: "spanish" } );

measurementUnitSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});


measurementUnitSchema.pre('remove', function (next) {

	//TODO: Verify whether measuring unit can be removed. Until then, prevent removing.
	let err = new Error('Measuring unit can not be deleted.')
	return next(err)

})

measurementUnitSchema.post('save', function (doc,next) {

    var cost = require('./../helpers/cost');
    var postSaveParentUnits = this.parentUnits;
    var originalParentUnits;
    var measurementUnitId = this._id;
		var queue = require('../queues/recipeConvCost')


    if ((this&&this._original&&this._original.parentUnits)&&(this&&this.parentUnits)) { //There is at least one conversion in original and post-save. Otherwise it can't be an update.
        
        originalParentUnits = this._original.parentUnits;
        postSaveParentUnits = this.parentUnits;

        //Go over each original parent unit and, if 'post save' version has it, compare quantity values
        originalParentUnits.forEach((originalParentUnit) =>{

            //Go over 'post save' parent units and compare
            postSaveParentUnits.forEach((parentUnit)=>{

                let parentUnitId = new ObjectId(parentUnit.unit);
                let originalParentUnitId = new ObjectId(originalParentUnit.unit);

                if(parentUnitId.equals(originalParentUnitId) && (parentUnit.quantity!=originalParentUnit.quantity)) {
                    //Conversion quantity has been updated. Only one can be updated at a time.
                    //Must recalculate cost of subproduct's that have composition elements with this measurement unit.
                    //console.log('conversion of ' + measurementUnitId + ' has been updated')
										
										queue.updateRecipeConvCost(
							  			{
							  				title: 'Post-save measuring unit hook - Calculate and update recipe\'s cost based on updated unit conversion value.',
							  				measurementUnitId: measurementUnitId, 
							  				parentUnitId: parentUnit.unit,
												equivalenceUnitFlag: false 
							  			}
							  		);
                }
            })

        })
    }
  this._original = this.toJSON();
  next();
});

//creating model
var model = mongoose.model('measurementUnit', measurementUnitSchema);
module.exports = model;