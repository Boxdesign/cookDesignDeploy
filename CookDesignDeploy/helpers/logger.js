var winston = require('winston');
var WinstonCloudwatch = require('winston-cloudwatch')
//var CloudWatchTransport = require('winston-aws-cloudwatch')
var config = require('./../config/config');
var amazonKeyId = config.awsBucket.accessKey; //app.get('amazonKeyId')
var amazonKeySecret = config.awsBucket.secret; //app.get('amazonKeySecret')
var awsRegion = config.awsBucket.region; //app.get('amazonKeySecret')
var logGroupName;

require("events").EventEmitter.defaultMaxListeners= 0;
process.setMaxListeners(0);

if (process.env.NODE_ENV == 'production') {

    if (process.env.SERVER_TYPE == 'worker') {
        logGroupName = process.env.ORGANIZATION + '-' + config.awsCloudWatch.logGroupNameWorker + '-Prod'
    } else {
        logGroupName = process.env.ORGANIZATION + '-' + config.awsCloudWatch.logGroupNameWeb + '-Prod'
    }

} else if (process.env.NODE_ENV == 'staging') {

    if (process.env.SERVER_TYPE == 'worker') {
        logGroupName = process.env.ORGANIZATION + '-' + config.awsCloudWatch.logGroupNameWorker + '-Staging'
    } else {
        logGroupName = process.env.ORGANIZATION + '-' + config.awsCloudWatch.logGroupNameWeb + '-Staging'
    }
}

exports.userLogs = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'info',
            retentionInDays: 7,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-userLogs'
        }) :
        new winston.transports.File({
            filename: './log/userLogs.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});




exports.worker = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-worker'   
        }) :
        new winston.transports.File({
            filename: './log/worker.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});



exports.server = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-server'
        }) :
        new winston.transports.File({
            filename: './log/server.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.location = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-location'
        }) :
        new winston.transports.File({
            filename: './log/location.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.family = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-family'
        }) :
        new winston.transports.File({
            filename: './log/family.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.quartering = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-quartering'
        }) :
        new winston.transports.File({
            filename: './log/quartering.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.dishHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-dishHooks'
        }) :
        new winston.transports.File({
            filename: './log/dishHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});


exports.drinkHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-drinkHooks'
        }) :
        new winston.transports.File({
            filename: './log/drinkHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.utensilHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-utensilHooks'
        }) :
        new winston.transports.File({
            filename: './log/utensilHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.locationHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-locationHooks'
        }) :
        new winston.transports.File({
            filename: './log/locationHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.userHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-userHooks'
        }) :
        new winston.transports.File({
            filename: './log/userHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.packFormatHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-packFormatHooks'
        }) :
        new winston.transports.File({
            filename: './log/packFormatHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.allergenHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-allergenHooks'
        }) :
        new winston.transports.File({
            filename: './log/allergenHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.gastroHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-gastroHooks'
        }) :
        new winston.transports.File({
            filename: './log/gastroHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.ingredientHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-ingredientHooks'
        }) :
        new winston.transports.File({
            filename: './log/ingredientHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.packagingHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-packagingHooks'
        }) :
        new winston.transports.File({
            filename: './log/packagingHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.providerHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-providerHooks'
        }) :
        new winston.transports.File({
            filename: './log/providerHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.subproductHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-subproductHooks'
        }) :
        new winston.transports.File({
            filename: './log/subproductHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.productHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-productHooks'
        }) :
        new winston.transports.File({
            filename: './log/productHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.articleHooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-articleHooks'
        }) :
        new winston.transports.File({
            filename: './log/articleHooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.gastroCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-gastroCost'
        }) :
        new winston.transports.File({
            filename: './log/gastroCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.controllers = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-controllers'
        }) :
        new winston.transports.File({
            filename: './log/controllers.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.selentaIngWebService = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-selentaIngWebService'
        }) :
        new winston.transports.File({
            filename: './log/selentaIngWebService.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.selentaSubpWebService = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-selentaSubpWebService'
        }) :
        new winston.transports.File({
            filename: './log/selentaSubpWebService.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.selentaMPWebService = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-selentaMPWebService'
        }) :
        new winston.transports.File({
            filename: './log/selentaMPWebService.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.selentaDishWebService = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-selentaDishWebService'
        }) :
        new winston.transports.File({
            filename: './log/selentaDishWebService.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.selentaMasterDataWebService = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-selentaMasterDataWebService'
        }) :
        new winston.transports.File({
            filename: './log/selentaMasterDataWebService.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.dataExport = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-dataExport'
        }) :
        new winston.transports.File({
            filename: './log/dataExport.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.printBooks = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-printBooks'
        }) :
        new winston.transports.File({
            filename: './log/printBooks.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.printArticles = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-printArticles'
        }) :
        new winston.transports.File({
            filename: './log/printArticles.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.costHelper = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-costHelper'
        }) :
        new winston.transports.File({
            filename: './log/costHelper.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.articleQueue = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-articleQueue'
        }) :
        new winston.transports.File({
            filename: './log/articleQueue.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.printRecipe = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-printRecipe'
        }) :
        new winston.transports.File({
            filename: './log/printRecipe.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.printLibrary = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-printLibrary'
        }) :
        new winston.transports.File({
            filename: './log/printLibrary.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueGastroCompCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueGastroCompCost'
        }) :
        new winston.transports.File({
            filename: './log/queueGastroCompCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueGastroCompAllergens = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueGastroCompAllergens'
        }) :
        new winston.transports.File({
            filename: './log/queueGastroCompAllergens.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueRecipeCompAllergens = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueRecipeCompAllergens'
        }) :
        new winston.transports.File({
            filename: './log/queueRecipeCompAllergens.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueProvider = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueProvider'
        }) :
        new winston.transports.File({
            filename: './log/queueProvider.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueRecipeCompCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueRecipeCompCost'
        }) :
        new winston.transports.File({
            filename: './log/queueRecipeCompCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueRecipeConvCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueRecipeConvCost'
        }) :
        new winston.transports.File({
            filename: './log/queueRecipeConvCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queuePackCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queuePackCost'
        }) :
        new winston.transports.File({
            filename: './log/queuePackCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.report = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-report'
        }) :
        new winston.transports.File({
            filename: './log/report.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.generateSelentaReferenceNumber = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-generateSelentaReferenceNumber'
        }) :
        new winston.transports.File({
            filename: './log/generateSelentaReferenceNumber.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.locationCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-locationCost'
        }) :
        new winston.transports.File({
            filename: './log/locationCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.printAllergen = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-printAllergen'
        }) :
        new winston.transports.File({
            filename: './log/printAllergen.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.printGastroOffer = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-printGastroOffer'
        }) :
        new winston.transports.File({
            filename: './log/printGastroOffer.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.articleLocCostUpdate = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-articleLocCostUpdate'
        }) :
        new winston.transports.File({
            filename: './log/articleLocCostUpdate.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueUpdateMeasUnit = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueUpdateMeasUnit'
        }) :
        new winston.transports.File({
            filename: './log/queueUpdateMeasUnit.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueSingleArticleLocCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueSingleArticleLocCost'
        }) :
        new winston.transports.File({
            filename: './log/queueSingleArticleLocCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.removeCheckpoints = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-removeCheckpoints'
        }) :
        new winston.transports.File({
            filename: './log/removeCheckpoints.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.cleanUpQueue = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-cleanUpQueue'
        }) :
        new winston.transports.File({
            filename: './log/cleanUpQueue.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.selentaUtensilWebService = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-selentaUtensilWebService'
        }) :
        new winston.transports.File({
            filename: './log/selentaUtensilWebService.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.utils = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-utils'
        }) :
        new winston.transports.File({
            filename: './log/utils.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.allergens = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-allergens'
        }) :
        new winston.transports.File({
            filename: './log/allergens.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.compareLocationAllergens = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-compareLocationAllergens'
        }) :
        new winston.transports.File({
            filename: './log/compareLocationAllergens.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.allergenQueue = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-allergenQueue'
        }) :
        new winston.transports.File({
            filename: './log/allergenQueue.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueRefreshRecipesCompCosts = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueRefreshRecipesCompCosts'
        }) :
        new winston.transports.File({
            filename: './log/queueRefreshRecipesCompCosts.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.queueRefreshProductsPackCosts = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-queueRefreshProductsPackCosts'
        }) :
        new winston.transports.File({
            filename: './log/queueRefreshProductsPackCosts.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.refreshQuarteringCosts = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-refreshQuarteringCosts'
        }) :
        new winston.transports.File({
            filename: './log/refreshQuarteringCosts.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.refreshAllergens = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-refreshAllergens'
        }) :
        new winston.transports.File({
            filename: './log/refreshAllergens.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.calculateRecipeCompLocationCosts = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-calculateRecipeCompLocationCosts'
        }) :
        new winston.transports.File({
            filename: './log/calculateRecipeCompLocationCosts.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.printBook = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-printBook'
        }) :
        new winston.transports.File({
            filename: './log/printBook.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.subproductsInLocation = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-subproductsInLocation'
        }) :
        new winston.transports.File({
            filename: './log/subproductsInLocation.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.refreshArticleLocCost = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-refreshArticleLocCost'
        }) :
        new winston.transports.File({
            filename: './log/refreshArticleLocCost.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.removeImage = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-removeImage'
        }) :
        new winston.transports.File({
            filename: './log/removeImage.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.appVersion = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-appVersion'
        }) :
        new winston.transports.File({
            filename: './log/appVersion.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.appRelease = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-appRelease'
        }) :
        new winston.transports.File({
            filename: './log/appRelease.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.document = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-document'
        }) :
        new winston.transports.File({
            filename: './log/document.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.refreshIngLocAllergens = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-refreshIngLocAllergens'
        }) :
        new winston.transports.File({
            filename: './log/refreshIngLocAllergens.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});

exports.refreshLocAllergens = new(winston.Logger)({
    transports: [
        process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging' ?
        new WinstonCloudwatch({
            level: 'error',
            retentionInDays: 30,
            awsRegion: awsRegion,
            awsAccessKeyId: amazonKeyId,
            awsSecretKey: amazonKeySecret,
            logGroupName: logGroupName,
            logStreamName: 'AppLogs-refreshLocAllergens'
        }) :
        new winston.transports.File({
            filename: './log/refreshLocAllergens.log',
            handleExceptions: true,
            json: false,
            colorize: true,
            timestamp: true
        })
    ]
});