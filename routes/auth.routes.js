const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const isAuth = require("../middlewares/auth")


router.post('/login', authController.login);

router.post('/register', authController.register);
router.post('/googleLogin', authController.googleLogin);
router.post('/updateToken', isAuth, authController.updateFirebaseToken);

module.exports = router;
