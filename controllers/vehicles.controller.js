const crypto = require("crypto")
const pool = require('../database');
const instance = require("../razorpay")
const uuid = require("uuid");
const pgFormat = require("pg-format");

const vehicleController = {
    addVehicle: async (req, res, next) => {
        try {
            const userId = req.userId;
            const { type, vehicleno, manufacturer, model, color } = req.body;
            const vehicleId= uuid.v4();
            const insertQuery = `
              INSERT INTO Vehicle (ID, UserID, Type, VehicleNo, Manufacturer, Model, Color)
              VALUES ($7, $1, $2, $3, $4, $5, $6)
              RETURNING *
            `;
            const values = [userId,type, vehicleno, manufacturer, model, color, vehicleId];
            const result = await pool.query(insertQuery, values);
            res.status(201).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    },
    editVehicle: async (req, res, next) => {
        try {
            const userId = req.userId;
            const vehicleId = req.params.vehicleId;
            const {type, vehicleno, manufacturer, model, color } = req.body;
            const checkOwnershipQuery = 'SELECT * FROM Vehicle WHERE ID = $1 AND UserID = $2';
            const ownershipValues = [vehicleId, userId];
            const ownershipResult = await pool.query(checkOwnershipQuery, ownershipValues);
            if (ownershipResult.rows.length === 0) {
                const error = new Error('Vehicle not found or does not belong to the user.');
                error.status = 404;
                throw error;
            }
            const updateQuery = `
      UPDATE Vehicle
      SET Type = $1, VehicleNo = $2, Manufacturer = $3, Model = $4, Color = $5
      WHERE ID = $6
      RETURNING *
    `;
            const updateValues = [type, vehicleno, manufacturer, model, color, vehicleId];
            const result = await pool.query(updateQuery, updateValues);
            res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    },
    deleteVehicle: async (req, res, next) => {
        try {
            const userId = req.userId;
            const vehicleId = req.params.vehicleId;
            const checkOwnershipQuery = 'SELECT * FROM Vehicle WHERE ID = $1 AND UserID = $2';
            const ownershipValues = [vehicleId, userId];
            const ownershipResult = await pool.query(checkOwnershipQuery, ownershipValues);

            if (ownershipResult.rows.length === 0) {
                const error = new Error('Vehicle not found or does not belong to the user.');
                error.status = 404;
                throw error;
            }
            const deleteQuery = 'DELETE FROM Vehicle WHERE ID = $1';
            const deleteValues = [vehicleId];
            await pool.query(deleteQuery, deleteValues);
            res.status(200).json({ msg: 'Vehicle deleted successfully.' });
        } catch (error) { next(error); }
    },
    listUserVehicles: async (req, res, next) => {
        try {
            const userId = req.userId;
            const query = 'SELECT * FROM Vehicle WHERE UserID = $1';
            const values = [userId];
            const result = await pool.query(query, values);
            res.status(200).json(result.rows);
        } catch (error) {
            next(error);
        }
    }
}
module.exports = vehicleController;