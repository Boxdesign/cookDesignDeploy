'use strict';

var enums = {
    /*
     * Tipos de organizaciones que se pueden crear
     */
    location_types: [
        'organization',
        'company',
        'businessUnit'
    ],
    base_units: [
        'mass',
        'vol',
        'long',
        'unit',
        null
    ],
    families: [
        'ingredient',
        'utensil',
        'packaging',
        'recipe',
        'gastroOffering',
        'menu',
        'season'
    ],
    checkpoints: [
        'critical',
        'gastronomic'
    ],
    imageSizeCodes: [
        'xxs',
        'xs',
        's',
        'l',
        'xl',
        'original',
        'circle'
    ],
    compositionType: [
        'mainProduct',
        'sauce',
        'dressing',
        'addition'
    ],
    menuCalculMethod: [
        'calculByPrice',
        'calculByMargin'
    ],
    menuType: [
        'simpleMenu',
        'dailyMenuCarte',
        'buffet',
        'carte',
        'fixedPriceCarte',
        'catalog'
    ],
    gastroCompositionType: [
        'dish',
        'product'
    ],
    templateCategories:[
        'recipe',
        'subTemplate',
        'gastroOffer',
        'article',
        'library',
        'subproduct'
    ],
    templateSubcategories:[
        'subproduct',
        'product',
        'dish',
        'gastro',
        'book',
        'ingredient',
        'packaging',
        'allergen',
        'measurementUnit',
        'packFormat',
        'utensil',
        'checkpoint',
        'process',
        'family',
        'location'
    ],
    utensilExternalFamilies : [
        'crockery',
        'resource / machine',
        'utensil',
        'Vajilla',
        'Recurso/Máquina',
        'Utensilio',
        '---'
    ],
    selentaAllergenLevels : [
        'PUEDE',
        'SI',
        'NO'
    ],
    templateCodes : [
        {
            category: 'recipe',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Descriptiva',
            	langCode: 'es'
            },
            {
            	name: 'Descriptive',
            	langCode: 'en'
            }     
        ],
            templateCode: 'RS000',
            htmlFile: 'recipe-descriptive.html'
        },
        {
            category: 'recipe',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Analitica',
            	langCode: 'es'
            },
            {
            	name: 'Analytical',
            	langCode: 'en'
            }     
        ],            
            templateCode: 'RS001',
            htmlFile: 'recipe-analytic.html'
        },
        {
            category: 'recipe',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Comercial',
            	langCode: 'es'
            },
            {
            	name: 'Commercial',
            	langCode: 'en'
            }
        ],            
            templateCode: 'RS002',
            htmlFile: 'recipe-commercial.html'
        },
        {
            category: 'recipe',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Producción',
            	langCode: 'es'
            },
            {
            	name: 'Production',
            	langCode: 'en'
            }     
        ],            
            templateCode: 'RS003',
            htmlFile: 'recipe-production.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Descriptiva',
            	langCode: 'es'
            },
            {
            	name: 'Descriptive',
            	langCode: 'en'
            }     
        ],
            parentTemplateCode: 'RS000',            
            templateCode: 'SS000',
            htmlFile: 'recipe-subproduct-descriptive.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Analitica',
            	langCode: 'es'
            },
            {
            	name: 'Analytical',
            	langCode: 'en'
            }   
        ],
            parentTemplateCode: 'RS001',        
            templateCode: 'SS001',
            htmlFile: 'recipe-subproduct-analytic.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Comercial',
            	langCode: 'es'
            },
            {
            	name: 'Commercial',
            	langCode: 'en'
            } 
        ], 
            parentTemplateCode: 'RS002',        
            templateCode: 'SS002',
            htmlFile: 'recipe-subproduct-commercial.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Producción',
            	langCode: 'es'
            },
            {
            	name: 'Production',
            	langCode: 'en'
            }        
        ],    
            parentTemplateCode: 'RS003',        
            templateCode: 'SS003',
            htmlFile: 'recipe-subproduct-production.html'
        },
        {
            category: 'gastroOffer',
            subCategory: 'gastro',
            lang: [{
            	name: 'Descriptiva',
            	langCode: 'es'
            },
            {
            	name: 'Descriptive',
            	langCode: 'en'
            }   
        ],            
            templateCode: 'GG000',
            htmlFile: 'gastro-offer-descriptive.html'
        },
        {
            category: 'gastroOffer',
            subCategory: 'gastro',
            lang: [{
            	name: 'Analitica',
            	langCode: 'es'
            },
            {
            	name: 'Analytical',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'GG001',
            htmlFile: 'gastro-offer-analytic.html'
        },
        {
            category: 'gastroOffer',
            subCategory: 'book',
            lang: [{
            	name: 'Libro Comercial',
            	langCode: 'es'
            },
            {
            	name: 'Commercial Book',
            	langCode: 'en'
            }               
        ],            
            templateCode: 'GB000',
            htmlFile: 'gastro-offer-commercial-book.html'
        },
        {
            category: 'gastroOffer',
            subCategory: 'book',
            lang: [{
            	name: 'Libro Recetas',
            	langCode: 'es'
            },
            {
            	name: 'Recipes Book',
            	langCode: 'en'
            }       
        ],            
            templateCode: 'GB001',
            htmlFile: 'gastro-offer-recipes-book.html'
        },
        {
            category: 'gastroOffer',
            subCategory: 'book',
            lang: [{
            	name: 'Libro Costes',
            	langCode: 'es'
            },
            {
            	name: 'Costs book',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'GB002',
            htmlFile: 'gastro-offer-costs-book.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'book',
            lang: [{
            	name: 'Libro Comercial',
            	langCode: 'es'
            },
            {
            	name: 'Commercial Book',
            	langCode: 'en'
            }        
        ],   
            parentTemplateCode: 'GB000',        
            templateCode: 'SB000',
            htmlFile: 'gastro-offer-commercial-book-subtemplate.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'book',
            lang: [{
            	name: 'Libro Recetas',
            	langCode: 'es'
            },
            {
            	name: 'Recipes Book',
            	langCode: 'en'
            }        
        ],  
            parentTemplateCode: 'GB001',        
            templateCode: 'SB001',
            htmlFile: 'gastro-offer-recipes-book-subtemplate.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'book',
            lang: [{
            	name: 'Libro Costes',
            	langCode: 'es'
            },
            {
            	name: 'Costs Book',
            	langCode: 'en'
            }        
        ],   
            parentTemplateCode: 'GB002',        
            templateCode: 'SB002',
            htmlFile: 'gastro-offer-costs-book-subtemplate.html'
        },
        {
            category: 'article',
            subCategory: 'ingredient',
            lang: [{
            	name: 'Plantilla Ingredientes',
            	langCode: 'es'
            },
            {
            	name: 'Ingredients Template',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'AI000',
            htmlFile: 'ingredient-template.html'
        },
        {
            category: 'gastroOffer',
            subCategory: 'allergen',
            lang: [{
            	name: 'Alergenos de Oferta Gastronómica',
            	langCode: 'es'
            },
            {
            	name: 'Gastronomic Offer Allergens',
            	langCode: 'en'
            }     
        ],            
            templateCode: 'GA000',
            htmlFile: 'allergens-in-gastroOffer.html'
        },
        {
            category: 'library',
            subCategory: 'family',
            lang: [{
            	name: 'Listado de Famílias',
            	langCode: 'es'
            },
            {
            	name: 'Families List',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'LF000',
            htmlFile: 'library-families.html'
        },
        {
            category: 'library',
            subCategory: 'allergen',
            lang: [{
            	name: 'Listado de Alérgenos',
            	langCode: 'es'
            },
            {
            	name: 'Allergens List',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'LA000',
            htmlFile: 'library-allergens.html'
        },
        {
            category: 'library',
            subCategory: 'checkpoint',
            lang: [{
            	name: 'Listado Puntos de Control',
            	langCode: 'es'
            },
            {
            	name: 'Checkpoints List',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'LC000',
            htmlFile: 'library-checkpoint.html'
        },
        {
            category: 'library',
            subCategory: 'packFormat',
            lang: [{
            	name: 'Listado Formatos de Compra',
            	langCode: 'es'
            },
            {
            	name: 'Puchase Formats List',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'LPF000',
            htmlFile: 'library-packformat.html'
        },
        {
            category: 'library',
            subCategory: 'process',
            lang: [{
            	name: 'Listado de Procesos',
            	langCode: 'es'
            },
            {
            	name: 'Processes List',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'LP000',
            htmlFile: 'library-process.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'subproduct',
            lang: [{
            	name: 'Subproductos Libro Costes',
            	langCode: 'es'
            },
            {
            	name: 'Subproducts Costs Books',
            	langCode: 'en'
            }        
        ],  
            parentTemplateCode: '',        
            templateCode: 'SS004',
            htmlFile: 'gastro-offer-analytic-subproducts-template.html'
        },
        {
            category: 'article',
            subCategory: 'packaging',
            lang: [{
            	name: 'Plantilla Envases',
            	langCode: 'es'
            },
            {
            	name: 'Packaging Template',
            	langCode: 'en'
            }        
        ],            
            templateCode: 'AP000',
            htmlFile: 'packaging-template.html'
        },
        {
            category: 'subproduct',
            subCategory: 'location',
            lang: [{
                name: 'Listado de Subproductos por localizacion (SIMPLE)',
                langCode: 'es'
            },
            {
                name: 'List of Subproducts By Location (SIMPLE)',
                langCode: 'en'
            }        
        ],            
            templateCode: 'GB003',
            htmlFile: 'subproducts-by-location-book.html'
        },
        {
            category: 'subproduct',
            subCategory: 'location',
            lang: [{
                name: 'Listado subproductos por localizacion (DETALLADO)',
                langCode: 'es'
            },
            {
                name: 'List of Subproducts By Location (DETAILED)',
                langCode: 'en'
            }        
        ],            
            templateCode: 'GB004',
            htmlFile: 'subproducts-by-location-detailed-list.html'
        },
        {
            category: 'subTemplate',
            subCategory: 'subproduct',
            lang: [{
                name: 'Subproductos Libro Recetas',
                langCode: 'es'
            },
            {
                name: 'Recipes Book Subproducts',
                langCode: 'en'
            }     
        ],  
            parentTemplateCode: '',        
            templateCode: 'SS005',
            htmlFile: 'gastro-offer-subproducts-in-recipes-book.html'
        }
    ]
};

module.exports = enums;