'use strict';

var express = require('express');
var router = express.Router();


const family = require('../controllers/family_lib');

router.post('/', family.add);

router.post('/subfamily', family.addSubfamily);

router.put('/', family.edit);

router.put('/subfamily', family.editSubfamily);

router.get('/', family.getCategoryFamilies);

router.get('/details', family.getFamilyLang);

router.get('/details/subfamily', family.getSubFamilyLang);

router.get('/categories', family.getFamilyCat);

router.delete('/', family.remove);

router.delete('/subfamily', family.removeSubfamily);

router.get('/generatereferencenumber', family.generateReferenceNumber);

router.get('/generateSelentaRecipeFamilyReferenceNumber',family.generateSelentaRecipeFamilyReferenceNumber);

router.get('/downloadSelentaRecipeFamilyReferenceNumber',family.downloadSelentaRecipeFamilyReferenceNumber);

router.get('/assignFamilyToOrganizationLoc', family.assignFamilyToOrganizationLoc);

router.get('/assignFamilyToAllLoc', family.assignFamilyToAllLoc);

module.exports = router;

