var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var hasAllergensSchema  = new Schema({
    allergen: {
        type: Schema.Types.ObjectId,
        ref: 'allergen',
        required: true
    },
    level: {
        type: Number,
        required: true,
        enum: [0,1,2] //0 No allergen, 1 Has traces, 2 IS the allergen
    }
});

//creating model
var model = mongoose.model('hasAllergens', hasAllergensSchema);
module.exports = model;