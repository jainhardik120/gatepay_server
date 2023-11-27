const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/points.controller');
const isAuth = require("../middlewares/auth")


router.post('/', isAuth, pointsController.createPoint);

router.put('/:pointId', isAuth, pointsController.updatePoint);

router.get('/', isAuth, pointsController.getPoints);

router.delete('/:pointId', isAuth, pointsController.deletePoint);


module.exports = router;