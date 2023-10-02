const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parking.controller');
const isAuth = require("../middlewares/auth")

router.post('/assignParkingSpaceToVehicle', parkingController.assignParkingSpaceToVehicle)

router.post('/createParkingSpaces', isAuth, parkingController.createParkingSpaces);


module.exports = router;