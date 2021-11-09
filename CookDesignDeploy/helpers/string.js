var config = require('../config/config');

exports.randomString = (len)=> {
    var allChars = 'qwertyuiopasdfghjklñzxcvbnmQWERTYUIOPASDFGHJKLÑZXCVBNM123456789';
    var stringLen = len || config.tokenLen || len || 64
    var coded = '';
    for (let i = 0; i <= stringLen; i++) {
        coded += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    return coded;
};