var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '00 20 * * 5' : '0 4 * * *' //Prod At 20:00 UTC on Friday / 01:30 CET, dev every 5 min
var schedule;

switch (process.env.NODE_ENV) {
    case 'production':
        schedule = '0 14 * * 7' //Prod At 14:00 UTC on Sunday
        break;

    case 'staging':
        schedule = '0 20 * 12 5'
        break;

    default:
        schedule = '5 11 * * *'
        break
}


exports.refreshIngLocAllergensTask = cron.schedule(schedule, () => {

    var refreshIngLocAllergensQueue = require('../queues/refreshIngLocAllergens')

    refreshIngLocAllergensQueue.refreshIngLocAllergens({
        title: 'Refresh Ingredients Location Allergens ',
        model: 'ingredient'
    });

})