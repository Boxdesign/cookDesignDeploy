/*
 * This middleware should logs user calls to the API to AWS Cloudwatch in production
 */

var loggerHelper = require('../helpers/logger');

const logger = loggerHelper.userLogs;


exports.logger = (req, res, next) => {
  
  let method = req.method;
  let originalUrl = req.originalUrl;
  let userEmail = 'NO USER'
  let userId =  '---'
  let statusCode = 0;
  let statusMessage = '';
  let body = JSON.stringify(req.body);
  

  if (req.userData) {
    userEmail = req.userData.user.email
    userId =  req.userData.user._id
  }

  res.once('finish', function() {
    
    statusCode = res.statusCode;
    statusMessage = res.statusMessage;

    if (statusCode != 200 && method != 'GET')  {
      logger.info("%s (id: %s) --- REQUEST: %s : %s --- STATUS CODE: %s (%s) --- BODY: %s", userEmail, userId, method, originalUrl, statusCode, statusMessage, body);
    } else {
      logger.info("%s (id: %s) --- REQUEST: %s : %s --- STATUS CODE: %s (%s)", userEmail, userId, method, originalUrl, statusCode, statusMessage);
    }
  });

  next();
};
