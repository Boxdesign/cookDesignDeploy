'use strict';

var Upload = require('s3-uploader');
var config = require('./../config/config');
const Gallery = require('./../models/gallery');
const fs = require('fs');
var dbEnums = require('./../config/dbEnums')
var async = require('async')

exports.resizeAndUpload = (imgObject,imgObjCircle, folderPath, callback) => {

	var gallery;
	var sizes;

	async.waterfall([

		(cb) => {

		    var client = new Upload(config.awsBucket.bucketName, {
		        aws: {
		            path: (folderPath || 'imgs/'),
		            region: config.awsBucket.region,
		            acl: 'public-read',
		            accessKeyId: config.awsBucket.accessKey,
		            secretAccessKey: config.awsBucket.secret,
		        },
		        versions: [
		            {suffix: '-original'}
		        ],
		        cleanup: {
		            versions: true,
		            original: true
		        }
		    });

		    client.upload(imgObject.path, {}, (err, versions, meta) => {
		        if(err) return cb(err)

		        //console.log(versions, 'versions')
		      	//console.log(meta, 'meta')
		        sizes = [];
		        versions.forEach(function (image) {
		            sizes.push({
		                sizeCode: image.suffix.substr(1),
		                url: image.url
		            });
		        });
		        //Insertamos las imagenes en la galeria.

		        gallery = new Gallery({
		            originalName: imgObject.originalname,
		            sizes: sizes
		        }); 

		        cb(null, true)
		    })   


		}, (doc, cb) => { //Generate circle version of image

					var clientCircle = new Upload(config.awsBucket.bucketName, {
			        aws: {
			            path: (folderPath || 'imgs/'),
			            region: config.awsBucket.region,
			            acl: 'public-read',
			            accessKeyId: config.awsBucket.accessKey,
			            secretAccessKey: config.awsBucket.secret,
			        },
			        versions: [
			            //config.imageSizes.xxs,
			            {suffix: '-circle'}
			        ],
			        cleanup: {
			            versions: true,
			            original: true
			        }
			    });

	        clientCircle.upload(imgObjCircle.path, {}, (err, image, meta) => {
	            if(err) return cb(err)

	            let circle = {
	                sizeCode: 'circle',
	                url: image[0].url
	                         }

	            gallery.sizes.splice(0,0, circle);

	             gallery.save((err) => {
	                if(err) return cb(err);
	                cb(null, gallery)
	            })
	        })

		}], (err, gallery) => {

      if(err) return callback(err);
      callback(null, gallery)

	})

}














