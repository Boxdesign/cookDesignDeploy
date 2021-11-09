'use strict';

var waterfall = require('async-waterfall');
var s3Uploader = require('../helpers/s3_uploader');
var Gallery = require('../models/gallery');
var gm = require('gm').subClass({ imageMagick: true });
var config = require('./../config/config');
var {ObjectId} = require('mongodb');
var Gallery = require('../models/gallery')

/**
* @api {post} /gallery Add new imageCircle to the gallery
* @apiGroup {gallery}
* @apiName Add image
*
* @apiDescription This endpoint allow the web app and related services to upload a new image to the gallery
 *  When uploaded, it will return the gallery object with the different sizes and their URLS.
*
* @ApiHeader (Security) {String}  Authorization Auth Token
*
*
* @apiSuccess {Object} Field name  short desc
* @apiError Not Found Object field description
*
* @apiVersion 0.1.0
*
*/
exports.generateCircleImage = (req, callback) => {
    var original = req.file.path;
    var output = original +'-circle.png';
    var size=config.imageSizes.circle;
    var topCornerX;
    var topCornerY;
    var min,height,width;

    waterfall([
            (cb) => {
            gm(original)
            .identify(function (err, data) {
                if (!err){
                    height=data.size.height;
                    width=data.size.width;

                    if (width>height){
                        var alpha = (width-height)/2;
                        topCornerX=alpha;
                        topCornerY=0;
                        min=height;
                    } else {
                        var alpha = (height-width)/2;
                        topCornerX=0;
                        topCornerY=alpha;
                        min=width;
                    };
                    cb(null,true)
                } else {
                    return cb(err);
                }
        })
        }, (doc,cb)=>{

                    gm(original)
                        .crop(min, min,topCornerX,topCornerY)
                        .resize(size, size)
                        .write(output, function() {
                            gm(size, size, 'transparent')
                                .fill(output)
                                .drawCircle((size/2)-1,(size/2)-1, size/2, 0)
                                .write(output, function(err) {
                                   var imgObjCircle={
                                        fieldname: 'file',
                                        originalname: req.file.originalname,
                                        path: output

                                    };
                                    cb(null, imgObjCircle)
                                });
                        });
                
            
        }], (err, imgObjCircle) => {
                if (err) return callback(err);
                callback(null,imgObjCircle)
        });
};


// exports.generateLogoImage = (req, cb) => {
//     var original = req.file.path;
//     var output = original +'-logo.png';
//     var size=config.imageSizes.circle;
//     var topCornerX;
//     var topCornerY;
//     var min,height,width;

//     waterfall([
//             (cb) => {
//             gm(original)
//             .identify(function (err, data) {
//                 if (!err){
//                     height=data.size.height;
//                     width=data.size.width;

//                     if (width>height){
//                         var alpha = (width-height)/2;
//                         topCornerX=alpha;
//                         topCornerY=0;
//                         min=height;
//                     } else {
//                         var alpha = (height-width)/2;
//                         topCornerX=0;
//                         topCornerY=alpha;
//                         min=width;
//                     };
//                     cb(null,true)
//                 } else {
//                 return res.status(500).json(err).end();
//                 }
//         })
//         }, (doc,cb)=>{

//                     gm(original)
//                         .crop(min, min,topCornerX,topCornerY)
//                         .resize(size, size)
//                         .write(output, function() {
//                             gm(size, size, 'transparent')
//                                 .fill(output)
//                                 .drawCircle((size/2)-1,(size/2)-1, size/2, 0)
//                                 .write(output, function(err) {
//                                    var imgObjCircle={
//                                         fieldname: 'file',
//                                         originalname: req.file.originalname,
//                                         path: output

//                                     };
//                                     cb(null, imgObjCircle)
//                                 });
//                         });
                
            
//         }], (err, imgObjCircle) => {
//                 if (err) {
//                     return res.status(500).json(err).end();
//                 }
//                 cb(null,imgObjCircle)
//         });
// };