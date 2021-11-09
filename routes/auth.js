var express = require('express');
var router = express.Router();

//importamos controlador de usuarios
const auth = require('./../controllers/auth');


router.post('/login', auth.login);

router.post('/account', auth.useAccount);

router.get('/loggedin', auth.isLoggedIn);

// router.post('/create', user.create);

module.exports = router;
