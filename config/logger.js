'use strict'
var logs = {
	files:[
		{
			name:'server',
			devConfig:{
				filename: './log/server.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-server',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'location',
			devConfig:{
				filename: './log/location.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-location',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'quartering',
			devConfig:{
				filename: './log/quartering.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-quartering',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'dishHooks',
			devConfig:{
				filename: './log/dishHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-dishHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'gastroHooks',
			devConfig:{
				filename: './log/gastroHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-gastroHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'ingredientHooks',
			devConfig:{
				filename: './log/ingredientHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-ingredientHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'packagingHooks',
			devConfig:{
				filename: './log/packagingHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-packagingHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'providerHooks',
			devConfig:{
				filename: './log/providerHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-providerHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'subproductHooks',
			devConfig:{
				filename: './log/subproductHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-subproductHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'productHooks',
			devConfig:{
				filename: './log/productHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-productHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'articleHooks',
			devConfig:{
				filename: './log/articleHooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-articleHooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'gastroCost',
			devConfig:{
				filename: './log/gastroCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-gastroCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'controllers',
			devConfig:{
				filename: './log/controllers.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-controllers',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'selentaIngWebService',
			devConfig:{
				filename: './log/selentaIngWebService.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-selentaIngWebService',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'selentaSubpWebService',
			devConfig:{
				filename: './log/selentaSubpWebService.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-selentaSubpWebService',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'selentaMPWebService',
			devConfig:{
				filename: './log/selentaMPWebService.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-selentaMPWebService',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'selentaDishWebService',
			devConfig:{
				filename: './log/selentaDishWebService.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-selentaDishWebService',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'selentaMasterDataWebService',
			devConfig:{
				filename: './log/selentaMasterDataWebService.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-selentaMasterDataWebService',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'dataExport',
			devConfig:{
				filename: './log/dataExport.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-dataExport',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'printBooks',
			devConfig:{
				filename: './log/printBooks.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-printBooks',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'printArticles',
			devConfig:{
				filename: './log/printArticles.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-printArticles',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'costHelper',
			devConfig:{
				filename: './log/costHelper.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-costHelper',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'articleQueue',
			devConfig:{
				filename: './log/articleQueue.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-articleQueue',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'printRecipe',
			devConfig:{
				filename: './log/printRecipe.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-printRecipe',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'printLibrary',
			devConfig:{
				filename: './log/printLibrary.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-printLibrary',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueGastroCompCost',
			devConfig:{
				filename: './log/queueGastroCompCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueGastroCompCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueGastroCompAllergens',
			devConfig:{
				filename: './log/queueGastroCompAllergens.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueGastroCompAllergens',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueRecipeCompAllergens',
			devConfig:{
				filename: './log/queueRecipeCompAllergens.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueRecipeCompAllergens',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueProvider',
			devConfig:{
				filename: './log/queueProvider.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueProvider',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueRecipeCompCost',
			devConfig:{
				filename: './log/queueRecipeCompCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueRecipeCompCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueRecipeConvCost',
			devConfig:{
				filename: './log/queueRecipeConvCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueRecipeConvCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queuePackCost',
			devConfig:{
				filename: './log/queuePackCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queuePackCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'report',
			devConfig:{
				filename: './log/report.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-report',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'generateSelentaReferenceNumber',
			devConfig:{
				filename: './log/generateSelentaReferenceNumber.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-generateSelentaReferenceNumber',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'locationCost',
			devConfig:{
				filename: './log/locationCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-locationCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'printAllergen',
			devConfig:{
				filename: './log/printAllergen.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-printAllergen',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'printGastroOffer',
			devConfig:{
				filename: './log/printGastroOffer.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-printGastroOffer',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'articleLocCostUpdate',
			devConfig:{
				filename: './log/articleLocCostUpdate.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-articleLocCostUpdate',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueUpdateMeasUnit',
			devConfig:{
				filename: './log/queueUpdateMeasUnit.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueUpdateMeasUnit',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueSingleArticleLocCost',
			devConfig:{
				filename: './log/queueSingleArticleLocCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueSingleArticleLocCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'worker',
			devConfig:{
				filename: './log/worker.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-worker',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'removeCheckpoints',
			devConfig:{
				filename: './log/removeCheckpoints.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-removeCheckpoints',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'cleanUpQueue',
			devConfig:{
				filename: './log/cleanUpQueue.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-cleanUpQueue',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'selentaUtensilWebService',
			devConfig:{
				filename: './log/selentaUtensilWebService.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-selentaUtensilWebService',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'utils',
			devConfig:{
				filename: './log/utils.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-utils',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'allergens',
			devConfig:{
				filename: './log/allergens.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-allergens',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'compareLocationAllergens',
			devConfig:{
				filename: './log/compareLocationAllergens.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-compareLocationAllergens',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'allergenQueue',
			devConfig:{
				filename: './log/allergenQueue.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-allergenQueue',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueRefreshRecipesCompCosts',
			devConfig:{
				filename: './log/queueRefreshRecipesCompCosts.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueRefreshRecipesCompCosts',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'queueRefreshProductsPackCosts',
			devConfig:{
				filename: './log/queueRefreshProductsPackCosts.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-queueRefreshProductsPackCosts',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'refreshQuarteringCosts',
			devConfig:{
				filename: './log/refreshQuarteringCosts.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-refreshQuarteringCosts',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'refreshAllergens',
			devConfig:{
				filename: './log/refreshAllergens.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-refreshAllergens',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'calculateRecipeCompLocationCosts',
			devConfig:{
				filename: './log/calculateRecipeCompLocationCosts.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-calculateRecipeCompLocationCosts',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'printBook',
			devConfig:{
				filename: './log/printBook.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-printBook',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'subproductsInLocation',
			devConfig:{
				filename: './log/subproductsInLocation.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-subproductsInLocation',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'refreshArticleLocCost',
			devConfig:{
				filename: './log/refreshArticleLocCost.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-refreshArticleLocCost',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'removeImage',
			devConfig:{
				filename: './log/removeImage.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-removeImage',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'appVersion',
			devConfig:{
				filename: './log/appVersion.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-appVersion',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'notifyNewRelease',
			devConfig:{
				filename: './log/notifyNewRelease.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-notifyNewRelease',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'document',
			devConfig:{
				filename: './log/document.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-document',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'family',
			devConfig:{
				filename: './log/family.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-family',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'refreshIngLocAllergens',
			devConfig:{
				filename: './log/refreshIngLocAllergens.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-refreshIngLocAllergens',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		},
		{
			name:'refreshLocAllergens',
			devConfig:{
				filename: './log/refreshLocAllergens.log',
	      level: '',
	      handleExceptions: true,
	      json: false,
	      maxsize: 5242880, //5MB
	      maxFiles: 1,
	      colorize: true,
	      timestamp:true
			},
			prodConfig:{
				level: '',
				logGroupName: '',
	      logStreamName: 'AppLogs-refreshLocAllergens',
	      retentionInDays:90,
	      awsAccessKeyId: '',
	      awsSecretKey:'',
	      awsRegion: 'eu-west-1',
	      jsonMessage: false
			}
		}
	]
}

module.exports = logs;
