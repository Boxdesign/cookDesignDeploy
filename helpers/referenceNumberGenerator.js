//HELPER

var config = require('../config/config');

exports.generateReferenceNumber = (prefix) => {
    //console.log(prefix,'prefix')
   	var date = new Date()
    var result = prefix + String(date.getFullYear())
    result += String("0" + (date.getMonth()+1)).slice(-2)
    result += String("0" + date.getDate()).slice(-2)
    result += String("0" + date.getHours()).slice(-2)
    result += String("0" + date.getMinutes()).slice(-2)
    result += String("0" + date.getSeconds()).slice(-2)
    result += String("0" + date.getMilliseconds())
    //console.log(result,'generate Reference Number')
    return result

};