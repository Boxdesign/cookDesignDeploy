var express = require('express');
var router = express.Router();

//importamos controlador 
const template = require('./../controllers/template');


router.post('/', template.add);

router.delete('/', template.remove);

router.put('/', template.updateTemplate);

router.get('/', template.getTemplates);

module.exports = router;