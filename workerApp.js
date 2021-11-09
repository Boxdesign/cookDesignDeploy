//MongoDB
var config = require('./config/config');
var mongoose = require('mongoose');
var i18n = require('i18n');

i18n.configure({
  locales: ['es', 'en'],
  directory: './templates/locales',
  defaultLocale: 'es'
});

mongoose.connect(config.mongoUrl, {
  useMongoClient: true,
  poolSize: 10 // Maintain up to 10 socket connections
});

//Models
var Gallery = require('./models/gallery');
var Composition = require('./models/composition');
var PackComposition = require('./models/packComposition');
var GastroComposition = require('./models/gastroComposition');
var CookingSteps = require('./models/cookingSteps');
var MeasurementUnit = require('./models/measurementUnit');
var Subproduct = require('./models/subproduct');
var GastroOffer = require('./models/gastroOffer');
var Product = require('./models/product');
var Dish = require('./models/dish');
var User = require('./models/user');
var Auth = require('./models/auth');
var Account = require('./models/account');
var Checkpoint = require('./models/checkpoint');
var Location = require('./models/location');
var Packaging = require('./models/packaging');
var PackFormat = require('./models/packFormat');
var Process = require('./models/process');
var Role = require('./models/role');
var Utensil = require('./models/utensil');
var Family = require('./models/family');
var Ingredient = require('./models/ingredient');
var Allergen = require('./models/allergen');
var HasAllergens = require('./models/hasAllergens');
var Template = require('./models/template');
var Article = require('./models/article');
var Provider = require('./models/provider');
var Document = require('./models/document');
var Drink = require('./models/drinks');
var Selenta = require('./models/selenta');
var Kitchen = require('./models/kitchen');

var winstonLogger = require('./helpers/logger');