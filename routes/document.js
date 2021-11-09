'use strict';

var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/tmp/'); // Absolute path. Folder must exist, will not be created for you.
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const document = require('../controllers/document');

var upload = multer({ storage: storage });

router.post('/document',  upload.single('file'), document.uploadFile);

router.get('/listFiles', document.listFiles);

router.get('/getFile', document.getFile);

router.get('/changeProviderFiles', document.changeProviderFiles);

router.get('/changeArticleFiles', document.changeArticleFiles);

router.delete('/deleteFile', document.deleteFile);

router.get('/changeName', document.changeName);

module.exports = router;