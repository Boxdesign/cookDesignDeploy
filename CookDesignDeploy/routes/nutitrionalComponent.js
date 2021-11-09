'use strict';

var express = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer({
    dest: './public/img/allergens/',
    rename: function (fieldname, filename) {
        return fieldname;
    },
    onFileUploadStart: function (file) {
        console.log(file.originalname + ' is starting ...')
    },
    limits: {
        files: 1
    },
    onFileUploadComplete: function (file) {
        console.log(file.fieldname + ' uploaded to  ' + file.path);
        imageUploaded = true;
    }
});

const nutri = require('../controllers/nutritionalComponent_lib');

router.post('/', upload.single('photo'), nutri.add);

router.put('/', nutri.edit);

router.get('/', nutri.getAll);

router.delete('/', nutri.remove);

module.exports = router;
