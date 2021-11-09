'use strict'

var config = {
    mongoUrl: process.env.MONGO_URL || 'mongodb://localhost/cookDesign',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',  
    selentaWebServiceUrl: process.env.SELENTA_URL || 'http://localhost:3000/api/Tasks/webService',
    secret: '3HqU^*bx br6-C%&}2-D}_b)',
    selentaModule: true,
    tokenLen: 64,
    tonkenExp: 24,//hours,
    awsBucket: {
        bucketName: process.env.aws_bucket || 'cookdesign-dev',
        region: 'eu-west-1',
        accessKey: process.env.aws_access_key || 'AKIAJC5TWP34YJIB3VHA',
        secret: process.env.aws_secret_key || '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'
    },
    awsCloudWatch:{
      logGroupNameWeb: 'CookDesignWeb',
      logGroupNameWorker: 'CookDesignWorker'
    },
    selenta: {
    		wsIngUrl : process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? 'http://wd.expogrupo.com:80/sap/smartresorts/ZWS_INGREDIENTS' : 'http://wd-eei.expogrupo.com:80/sap/smartresorts/ZWS_INGREDIENTS',
    		wsSubproductUrl: process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? 'http://wd.expogrupo.com:80/sap/smartresorts/ZWS_SEMIELABORATS' : 'http://wd-eei.expogrupo.com:80/sap/smartresorts/ZWS_SEMIELABORATS',
    		wsDishUrl: process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? 'http://wd.expogrupo.com:80/sap/smartresorts/ZWS_PLATS' : 'http://wd-eei.expogrupo.com:80/sap/smartresorts/ZWS_PLATS',
        wsMPUrl:  process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? 'http://wd.expogrupo.com:80/sap/smartresorts/zws_download_mp' : 'http://wd.expogrupo.com:80/sap/smartresorts/zws_download_mp',
        wsMasterDataUrl: 'http://wd.expogrupo.com:80/sap/smartresorts/zws_download_dm',
        wsUtensilUrl: process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? 'http://wd.expogrupo.com:80/sap/smartresorts/ZWS_RECURSOS' : 'http://wd-eei.expogrupo.com:80/sap/smartresorts/ZWS_RECURSOS',
        allergenCodes: [
					{ type: 'ZCEREALES_GLUT', code:'A'}, //Cereales con gluten 
					{ type: 'ZCRUSTACEOS', code: 'B'}, //crustaceos 
					{ type: 'ZHUEVOS', code: 'C'}, //huevos 
					{ type: 'ZPESCADOS', code: 'D'}, //pescados 
					{ type: 'ZCACAHUETES', code: 'E'}, //cacahuetes 
					{ type: 'ZSOJA', code: 'F'}, //soja 
					{ type: 'ZLACTEOS', code: 'G'}, //lacteos 
					{ type: 'ZFRUTOS_SEC', code:	'H'}, //frutos secos 
					{ type: 'ZAPIO', code:	'L'}, //apio 
					{ type: 'ZMOSTAZA', code: 'M'}, //mostaza 
					{ type: 'ZSESAMO', code:	'N'}, //sesamo 
					{ type: 'ZSULFITOS', code:	'O'}, //sulfitos 
					{ type: 'ZALTRAMUCES', code: 'P'}, //altramuces 
					{ type: 'ZMOLUSCOS', code:	'R'}, //moluscos 
					{ type: 'Z0MG', code: 'S'} //omg
        ]
    },
    articleLocCostUpdate: {
    	perPage: process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? 3 : 3,
    	maxLogs: 100,
    	maxUpdatedArticles: 20
    },
    apiUrl: process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? process.env.API_URL : 'http://localhost:3333',
    workerToken: '1r992979361b626wy95Y1kLw56555Nc6Z32eU28y176qO1p0jM',
    kue: {
    	completedJobMaxAge: 2,
    	failedJobMaxAge: 10,
    	queuedJobMaxAge: 2,
    	scale: process.env.NODE_ENV == 'production' || process.env.NODE_ENV == 'staging'? 'd' : 's' //Could be 'w'-weeks, 'd'-days, 'h'-hours, 'm'-minutes, 's'-seconds, 'ms'-miliseconds
    },
    github: {
    	accessToken: '79bc279338ffb00dd0fad4488a74c96fda639d66',
    	repoUrl: 'https://api.github.com/repos/albirasolutions/CookDesignAPI/releases',
    	organization: 'albirasolutions',
    },
    imageSizes: {
        xxs: {
            maxHeight: 64,
            maxWidth: 64,
            suffix: '-xxs',
        },
        xs: {
            maxHeight: 125,
            maxWidth: 125,
            suffix: '-xs',
        },
        s: {
            maxHeight: 300,
            maxWidth: 300,
            suffix: '-s',
        },
        l: {
            maxHeight: 600,
            maxWidth: 600,
            suffix: '-l',
        },
        xl: {
            maxHeight: 1024,
            maxWidth: 1024,
            suffix: '-xl',
        },
         circle: 50
        // logo:{
        //     maxHeight: 275,
        //     maxWidth: 275,
        //     suffix: '-logo',
        // }

    },
    timeIntervals : [
      {
        time: 'days',
        value: 'd.'
      },{
        time: 'months',
        value: 'm.'
      }
    ],
    cookingStepsTimeUnits : [
      {
        unit: 'seconds'
      },
      {
        unit: 'minutes'
      },
      {
        unit: 'hours'
      }
    ],
    refNumberPrefixes: {
    		ingredient: '000',
    		packaging: '001',
    		subproduct: '002',
    		product: '003',
    		dish: '004',
    		drink:'005',
    		menu: '010',
    		dailyMenuCarte: '011',
    		buffet: '012',
    		carte: '013',
    		fixedPriceCarte: '014',
    		catalog: '015',
    		family: '100',
    		subfamily: '101',
    		process: '110',
    		packFormat: '120',
    		utensil: '130',
    		checkpoint: '140',
    		allergen: '150',
        kitchen: '160',
        workRoom: '170' 	
    },
    allergenCodes: [
			{ type: 'glutenContainingGrains', code:'A'}, //Cereales con gluten
			{ type: 'crustaceans', code: 'B'}, //crustaceos
			{ type: 'egg', code: 'C'}, //huevos
			{ type: 'fish', code: 'D'}, //pescados
			{ type: 'peanut', code: 'E'}, //cacahuetes
			{ type: 'soy', code: 'F'}, //soja
			{ type: 'milkOrLactose', code: 'G'}, //lacteos
			{ type: 'edibleNuts', code:	'H'}, //frutos secos
			{ type: 'celery', code:	'L'}, //apio
			{ type: 'mustard', code: 'M'}, //mostaza
			{ type: 'sesame', code:	'N'}, //sesamo
			{ type: 'sulphites', code:	'O'}, //sulfitos
			{ type: 'lupines', code: 'P'}, //altramuces
			{ type: 'molluscs', code:	'R'}, //moluscos
			{ type: 'geneticallyModifiedFoods', code: 'S'} //omg
    ],
    salesTax: 10,
    entities: [ //Each entity should have a route
      {
          name : 'user',
          type: 'system'
      },
      {
          name : 'role',
          type: 'system'
      },
      {
          name : 'location',
          type: 'system'
      },
      {
          name : 'measurementUnit',
          type: 'application'
      },
      {
          name : 'family',
          type: 'application'
      },
      {
          name : 'utensil',
          type: 'application'
      },
      {
          name : 'checkpoint',
          type: 'application'
      },
      {
          name : 'process',
          type: 'application'
      },
      {
          name : 'packaging',
          type: 'application'
      },
      {
          name : 'packformat',
          type: 'application'
      },
      {
          name : 'allergen',
          type: 'application'
      },
      {
          name : 'gastrofamily',
          type: 'application'
      },
      {
          name : 'ingredient',
          type: 'application'
      },
      {
          name : 'config',
          type: 'system'
      },
      {
          name : 'gallery',
          type: 'system'
      },
      {
          name : 'subproduct',
          type: 'application'
      },
      {
          name : 'account',
          type: 'system'
      },
      {
          name : 'dish',
          type: 'application'
      },
      {
          name : 'product',
          type: 'application'
      },
      {
          name : 'gastro-offer',
          type: 'application'
      },
      {
          name : 'report',
          type: 'application'
      },
      {
          name : 'template',
          type: 'system'
      },
      {
          name : 'provider',
          type: 'application'
      },
      {
          name : 'document',
          type: 'system'
      },
      {
          name : 'article',
          type: 'application'
      },
      {
          name : 'admin',
          type: 'application'
      },
      {
          name : 'drink',
          type: 'application'
      },
      {
          name : 'export',
          type: 'application'
      },
      {
          name : 'print',
          type: 'application'
      },
      {
          name : 'print-book',
          type: 'application'
      },
      {
          name : 'queue',
          type: 'system'
      }  ,
      {
          name : 'selentaImport',
          type: 'application'
      },
      {
        name: 'kitchen',
        type: 'application'
      },
      {
        name: 'workRoom',
        type: 'application'
      },
      {
        name: 'utils',
        type: 'system'
      }         
    ],
    measurementUnitIsoCodes: [
      {
        name: 'Botella 0.75',
        code: 'BL'
      },
      {
        name: 'Pinta Imperial',
        code: 'PTiM'
      },
      {
        name: 'Cucharadita',
        code: 'TSP'
      },
      {
        name: 'Onza',
        code: 'OZ'
      },
      {
        name: 'Gramos',
        code: 'G'
      },
      {
        name: 'Libra',
        code: 'LB'
      },
      {
        name: 'Pinta Americana',
        code: 'PT'
      },
      {
        name: 'Kilogramo',
        code: 'KG'
      },
      {
        name: 'Botella 0.75L',
        code: 'BL075'
      },
      {
        name: 'Unidad',
        code: 'UD'
      },
      {
        name: 'Taza',
        code: 'CUP'
      },
      {
        name: 'Litro',
        code: 'L'
      },
      {
        name: 'Cucharada',
        code: 'TBSP'
      },
      {
        name: 'Pastón',
        code: 'PS'
      },
      {
        name: 'Vaso Ikea',
        code: 'VK'
      },
      {
        name: 'Centilítros',
        code: 'CL'
      }
    ],
    maxNumVersionsGastroOffer: 10,
    maxNumVersionsRecipes: 10,
    traduible:{
      "process": ["name","description"],
      "allergen": ["name","description"],
      "checkpoint": ["name","description"],
      "family":["name"],
      "kitchen": ["name","description"],
      "measurementUnit":["name"],
      "packFormat":["name","description"],
      "utensil": ["name","accessories"],
      "packaging":["name","description"],
      "ingredient" : ["name","description","tastingNote"]
    }
};

module.exports = config;

