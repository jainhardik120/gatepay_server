const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const uuid = require("uuid");
const { OAuth2Client } = require("google-auth-library");
const secretKey = process.env.SECRET_KEY;

function generateRandomPassword(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset.charAt(randomIndex);
    }
    return password;
}

const authController = {
    login: async (req, res, next) => {
        try {
            const { Email, Password } = req.body;
            if (!Email || !Password) {
                const error = new Error('Email and Password are required.');
                error.status = 400;
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
            res.status(200).json({ token, isNewUser: false, userID: user.rows[0].id, Name: user.rows[0].name, Email: user.rows[0].email });
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
            res.status(201).json({ token, isNewUser: true, userID: newUser.rows[0].id, Name: newUser.rows[0].name, Email: newUser.rows[0].email });
        } catch (error) {
            next(error);
        }
    },
    googleLogin: async (req, res, next) => {
        try {
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
            const { idToken } = req.body
            const ticket = await client.verifyIdToken({
                idToken: idToken,
                audience: process.env.GOOGLE_CLIENT_ID
            })
            const payload = ticket.getPayload();
            const email = payload.email;

            const user = await pool.query('SELECT * FROM Users WHERE Email = $1', [email]);

            if (user.rows.length > 0) {
                const token = jwt.sign({ userId: user.rows[0].ID }, secretKey);
                return res.json({ token, isNewUser: false, userID: user.rows[0].id, Name: user.rows[0].name, Email: user.rows[0].email });
            } else {
                const generatedPassword = generateRandomPassword(32);
                const saltRounds = 10;
                const hashedPassword = bcrypt.hashSync(generatedPassword, saltRounds);
                const userId = uuid.v4();
                const newUser = await pool.query('INSERT INTO Users (ID, Name, Email, Password) VALUES ($1, $2, $3, $4) RETURNING *', [userId, `${payload.given_name} ${payload.family_name}`, email, hashedPassword]);
                const token = jwt.sign({ userId: newUser.rows[0].ID }, secretKey);
                return res.json({ token, isNewUser: true, userID: newUser.rows[0].id, Name: newUser.rows[0].name, Email: newUser.rows[0].email });
            }
        } catch (error) {
            next(error);
        }
    }
};

module.exports = authController;
