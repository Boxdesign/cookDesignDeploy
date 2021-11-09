var express = require('express');
var router = express.Router();

//importamos controlador 
const account = require('./../controllers/account');

router.get('/detail', account.getAccount);

router.get('/', account.getUserAccounts);

router.post('/', account.addAccount);

router.put('/', account.editAccount);

router.delete('/', account.remove);

module.exports = router;
