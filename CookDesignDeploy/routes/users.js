var express = require('express');
var router = express.Router();

const user = require('../controllers/user');

//Get users
router.get('/', user.getAll);

//Get user
router.get('/detail', user.getUser);

//Add user account
router.put('/account', user.createAccount);

//Edit user
router.put('/', user.edit);

//Change user password
router.put('/password', user.changePassword);

//Create user
router.post('/', user.create);

//Delete user
router.delete('/', user.remove);

module.exports = router;
