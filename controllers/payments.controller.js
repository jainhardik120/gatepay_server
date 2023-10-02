const crypto = require("crypto")
const pool = require('../database');
const instance = require("../razorpay")
const uuid = require("uuid");

const paymentsController = {
    checkBalance: async (req, res, next) => {
        try {
            const userId = req.userId;
            const queryResult = await pool.query('SELECT Balance FROM Users WHERE ID = $1', [userId]);

            if (queryResult.rows.length === 0) {
                const error = new Error('User not found.');
                error.status = 404;
                throw error;
            }

            const userBalance = queryResult.rows[0].balance;

            res.status(200).json({ balance: userBalance });
        } catch (error) {
            next(error);
        }
    },
    checkout: async (req, res, next) => {
        try {
            const userId = req.userId;
            const queryResult = await pool.query('SELECT Balance FROM Users WHERE ID = $1', [userId]);

            if (queryResult.rows.length === 0) {
                const error = new Error('User not found.');
                error.status = 404;
                throw error;
            }

            const options = {
                amount: Number(req.body.amount * 100),
                currency: "INR",
            };
            const order = await instance.orders.create(options);
            const transactionId = uuid.v4();
            const amount = req.body.amount;
            const startBalance = queryResult.rows[0].balance;
            const endBalance = startBalance;
            const transactionType = 'Recharge';
            const status = 'Pending';
            const currentTime = new Date();
            const insertTransactionQuery = `
            INSERT INTO UserTransactions (TransactionID, OrderID, Date, UserID, Amount, StartBalance, EndBalance, TransactionType, Status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
            const insertTransactionValues = [transactionId, order.id, currentTime, userId, amount, startBalance, endBalance, transactionType, status];

            await pool.query(insertTransactionQuery, insertTransactionValues);

            res.status(200).json({
                orderId: order.id,
                transactionId,
                amount: req.body.amount
            });
        } catch (error) {
            next(error);
        }
    },
    verifyPayment: async (req, res, next) => {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
                req.body;

            const body = razorpay_order_id + "|" + razorpay_payment_id;

            const expectedSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
                .update(body.toString())
                .digest("hex");

            const isAuthentic = expectedSignature === razorpay_signature;

            if (!isAuthentic) {
                const error = new Error('Can\'t verify payment');
                error.status = 400;
                throw error;
            }

            const searchTrasanctionResult = await pool.query(`SELECT * FROM UserTransactions WHERE OrderId = $1`, [razorpay_order_id]);

            if (searchTrasanctionResult.rows.length !== 1) {
                const error = new Error('Transaction was not found in system. Contact support if you think this is an error.');
                error.status = 404;
                throw error;
            }
            const transactionId = searchTrasanctionResult.rows[0].transactionid;
            const userIdFromDb = searchTrasanctionResult.rows[0].userid;
            if (userIdFromDb !== req.userId) {
                const error = new Error('Transaction not done by you. Contact support if you think this is an error.');
                error.status = 400;
                throw error;
            }
            if (searchTrasanctionResult.rows[0].status !== 'Pending') {
                const error = new Error('Transaction amount was already transferred into your account.')
                error.status = 400;
                throw error;
            }
            const amountToAdd = searchTrasanctionResult.rows[0].amount;
            const updateBalanceQuery = `
    UPDATE Users
    SET Balance = Balance + $1
    WHERE ID = $2
    RETURNING Balance;
`;
            const updateBalanceValues = [amountToAdd, userIdFromDb];

            const result = await pool.query(updateBalanceQuery, updateBalanceValues);
            const updatedBalance = result.rows[0].balance;
            const updateTransactionQuery = `
            UPDATE UserTransactions
            SET Status = $1, PaymentID = $2, SecureHash = $3, EndBalance = $4
            WHERE TransactionID = $5
        `;
            const updateTransactionValues = ['Complete', razorpay_payment_id, razorpay_signature, updatedBalance, transactionId];

            await pool.query(updateTransactionQuery, updateTransactionValues);
            res.status(200).json({ balance: updatedBalance });
        } catch (error) {
            next(error)
        }
    },
    chargeUser: async (req, res, next) => {
        try {
            const { userId, tolParId, amount } = req.body;
            const user = await pool.query('SELECT Balance FROM Users WHERE ID = $1', [userId]);

            if (user.rows.length === 0) {
                throw new Error('User not found.');
            }

            const userBalance = parseFloat(user.rows[0].balance);

            if (userBalance < amount) {
                throw new Error('Insufficient balance.');
            }
            const updateUserBalanceQuery = 'UPDATE Users SET Balance = Balance - $1 WHERE ID = $2';
            await pool.query(updateUserBalanceQuery, [amount, userId]);
            const updateParkingLotBalanceQuery = 'UPDATE TollsAndParkingSpaces SET Balance = Balance + $1 WHERE ID = $2';
            await pool.query(updateParkingLotBalanceQuery, [amount, tolParId]);
            const transactionId = uuid.v4();
            const currentDate = new Date();
            const transactionType = 'Payment';
            const status = 'Complete';
            const createTransactionQuery = `
      INSERT INTO UserTransactions (TransactionID, Date, UserID, Amount, StartBalance, EndBalance, TransactionType, Status, TOLPARID)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

            const createTransactionValues = [
                transactionId,
                currentDate,
                userId,
                amount,
                userBalance,
                userBalance - amount,
                transactionType,
                status,
                tolParId
            ];

            await pool.query(createTransactionQuery, createTransactionValues);

            res.json( { success: true, message: 'Payment successful.' });
        } catch (error) {
            next(error);
        }
    },
    userTransactions : async (req, res, next)=>{
        try {
            const userId = req.userId;

    const query = `
      SELECT
        ut.TransactionID,
        ut.Date,
        ut.TransactionType,
        ut.Status,
        ut.EndBalance,
        CASE
          WHEN ut.TransactionType = 'Recharge' THEN ut.Amount
          WHEN ut.TransactionType = 'Payment' THEN -ut.Amount
          ELSE ut.Amount
        END AS Amount,
        tps.Name AS TollOrParkingName,
        tps.LocationIdentifier AS Location
      FROM UserTransactions ut
      LEFT JOIN TollsAndParkingSpaces tps ON ut.TOLPARID = tps.ID
      WHERE ut.UserID = $1
      ORDER BY ut.Date DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    res.status(200).json({ transactions: rows });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = paymentsController;