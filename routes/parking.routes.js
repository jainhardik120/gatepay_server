const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parking.controller');
const isAuth = require("../middlewares/auth")

router.post('/assignParkingSpaceToVehicle', parkingController.assignParkingSpaceToVehicle)

router.post('/createParkingSpaces', isAuth, parkingController.createParkingSpaces);

router.get('/currentVehicleEntries', isAuth, parkingController.currentVehicleEntries)

router.get('/pastVehicleHistory', isAuth, parkingController.pastVehicleHistory)

module.exports = router;