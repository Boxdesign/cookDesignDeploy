var express = require('express');
var router = express.Router();

const queue = require('./../controllers/queue');


router.get('/cleanup-completed-jobs', queue.cleanUpCompletedJobs);

router.get('/cleanup-failed-jobs', queue.cleanUpFailedJobs);

router.get('/cleanup-stuck-jobs', queue.cleanUpStuckJobs);

router.get('/cleanup-queued-jobs', queue.cleanUpQueuedJobs);

module.exports = router;