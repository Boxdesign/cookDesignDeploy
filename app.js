var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var config = require('./config/config');
var cors = require('cors');
var multer = require('multer');
var idValidator = require('mongoose-id-validator');
var i18n = require('i18n');
var kue = require('kue');
var winstonLogger = require('./helpers/logger')
// Solution for Warning: Possible EventEmitter memory leak detected.
require('events').EventEmitter.defaultMaxListeners = 0;

i18n.configure({
  locales: ['es', 'en'],
  directory: './templates/locales',
  defaultLocale: 'es'
});
mongoose.Promise = global.Promise
mongoose.connect(config.mongoUrl, {
  useMongoClient: true,
  poolSize: 10 // Maintain up to 10 socket connections
});

kue.createQueue({redis: config.redisUrl});

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
var AppRelease = require('./models/appRelease');

var routes = require('./routes/index');
var users = require('./routes/users');
var config_routes = require('./routes/config');
var auth = require('./routes/auth');
var location = require('./routes/location');
var role = require('./routes/role');
var mu = require('./routes/measuramentUnit');
var family = require('./routes/family');
var utensil = require('./routes/utensil');
var checkpoint = require('./routes/checkpoint');
var packaging = require('./routes/packaging');
var packFormat = require('./routes/packFormat');
var process = require('./routes/process');
var allergen = require('./routes/allergen');
var ingredient = require('./routes/ingredient');
var subproduct = require('./routes/subproduct');
var product = require('./routes/product');
var gastroOffer = require('./routes/gastroOffer');
var dish = require('./routes/dish');
var gallery = require('./routes/gallery');
var account = require('./routes/account');
var template = require('./routes/template');
var report = require('./routes/report');
var article = require('./routes/article');
var provider = require('./routes/provider');
var document = require('./routes/document');
var dataExport = require('./routes/export');
var drink = require('./routes/drinks');
var print = require('./routes/print');
var printBook = require('./routes/printBook');
var queue = require('./routes/queue');
var selentaImport = require('./routes/selentaImport');
var kitchen = require ('./routes/kitchen');
var socketio = require ('./routes/socketio');
var utils = require ('./routes/utils');
var appRelease = require('./routes/appRelease')

var loggedIn = require('./middlewares/security');
var requestLogger = require('./middlewares/logger')

mongoose.plugin(idValidator);

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-type, Authorization');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
        res.sendStatus(200);
    }
    else {
        next();
    }
});

//@todo Clearn body parser
// app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
//     extended: true
// }));
app.use(bodyParser.json({limit: '10mb'}));
app.use(bodyParser.text());
app.use(bodyParser.raw());

//loggedIn middleware
app.use(loggedIn.loggedIn);
app.use(requestLogger.logger)
app.use(loggedIn.canDo);

app.use('/', routes);
app.use('/config', config_routes);
app.use('/auth', auth);
app.use('/user', users);
app.use('/location', location);
app.use('/role', role);
app.use('/measurementUnit', mu);
app.use('/family', family);
app.use('/utensil', utensil);
app.use('/checkpoint', checkpoint);
app.use('/process', process);
app.use('/packaging', packaging);
app.use('/packformat', packFormat);
app.use('/allergen', allergen);
app.use('/ingredient', ingredient);
app.use('/gallery', gallery);
app.use('/subproduct', subproduct);
app.use('/product', product);
app.use('/dish', dish);
app.use('/gastro-offer', gastroOffer);
app.use('/account', account);
app.use('/template', template);
app.use('/report', report);
app.use('/article', article);
app.use('/provider', provider);
app.use('/document', document);
app.use('/drink', drink);
app.use('/export', dataExport);
app.use('/print', print);
app.use('/print-book', printBook)
app.use('/kue', kue.app);
app.use('/queue', queue);
app.use('/selentaImport', selentaImport);
app.use('/kitchen', kitchen)
app.use('/socketio', socketio)
app.use('/utils', utils)
app.use('/appRelease',appRelease)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(500);
        res.json({
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(500);
    res.json('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;