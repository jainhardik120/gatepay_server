const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const uuid = require("uuid");
const secretKey = process.env.SECRET_KEY;

const authController = {
    login: async (req, res, next) => {
        try {
            const { Email, Password } = req.body;
            if (!Email || !Password) {
                const error = new Error('Name, Email, and Password are required.');
                error.status = 400;
                throw error;
            }
            const user = await pool.query('SELECT * FROM Users WHERE Email = $1', [Email]);
            if (user.rows.length === 0) {
                const error = new Error('Invalid email or password.');
                error.status = 401;
                throw error;
            }
            const passwordMatch = await bcrypt.compare(Password, user.rows[0].password);
            if (!passwordMatch) {
                const error = new Error('Invalid email or password.');
                error.status = 401;
                throw error;
            }
            const token = jwt.sign({ userId: user.rows[0].ID }, secretKey);
            res.status(200).json({ user: user.rows[0], token });
        } catch (error) {
            next(error);
        }
    },

    register: async (req, res, next) => {
        try {
            const { Name, Email, Password } = req.body;
            if (!Name || !Email || !Password) {
                const error = new Error('Name, Email, and Password are required.');
                error.status = 400;
                throw error;
            }
            const existingUser = await pool.query('SELECT * FROM Users WHERE Email = $1', [Email]);
            if (existingUser.rows.length > 0) {
                const error = new Error('User with this email already exists.');
                error.status = 400;
                throw error;
            }
            const userId = uuid.v4();
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(Password, saltRounds);
            const newUser = await pool.query('INSERT INTO Users (ID, Name, Email, Password) VALUES ($1, $2, $3, $4) RETURNING *', [userId, Name, Email, hashedPassword]);
            const token = jwt.sign({ userId: newUser.rows[0].ID }, secretKey);
            res.status(201).json({ user: newUser.rows[0], token });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = authController;
