const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicles.controller');
const isAuth = require("../middlewares/auth")

router.post('/add', isAuth, vehicleController.addVehicle);
router.put('/:vehicleId', isAuth, vehicleController.editVehicle);
router.delete('/:vehicleId', isAuth, vehicleController.deleteVehicle);
router.get('/', isAuth, vehicleController.listUserVehicles);

module.exports = router;
