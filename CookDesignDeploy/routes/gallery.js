'use strict';

var express = require('express');
var router = express.Router();
//multer agarrara las imagenes que llegen por multipart y las guardara en disco
//Tambien pasara los parametros a req.query (para claredad del codigo, el parametro sera
// obj y contendra un objeto JSON   )
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

var upload = multer({ storage: storage });

const gallery = require('../controllers/gallery');

router.post('/',  upload.single('file'), gallery.uploadImage);

router.get('/',  gallery.get);

router.get('/deleteGalleryDocsNotUsed',  gallery.deleteGalleryDocsNotUsed);

module.exports = router;
