const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payments.controller');
const isAuth = require("../middlewares/auth")

router.get('/checkBalance', isAuth, paymentController.checkBalance);
router.post('/checkout', isAuth, paymentController.checkout);
router.post('/verifyPayment', isAuth, paymentController.verifyPayment);
router.get('/userTransactions', isAuth, paymentController.userTransactions);
router.get('/spaceTransactions', isAuth, paymentController.spaceTransactions);

router.get('/spaceTransactions/:TransactionID', isAuth, paymentController.transactionDetails)

module.exports = router;