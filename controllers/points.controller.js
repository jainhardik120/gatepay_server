const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const uuid = require("uuid");

async function getParkingLotIdByEmployeeId(employeeId) {
    const query = `
            SELECT ParkingTollID
            FROM EmployeeAuthentication
            WHERE EmployeeID = $1;
        `;
    const result = await pool.query(query, [employeeId]);
    if (result.rows.length === 0) {
        const error = new Error('Invalid employee id');
        error.status = 404;
        throw error;
    }
    return result.rows[0].parkingtollid;
}

const pointsController = {
    createPoint: async (req, res, next) => {
        try {
            const parkingId = await getParkingLotIdByEmployeeId(req.userId);
            const { location, isActive } = req.body;
            const pointID = uuid.v4();
            const createPointQuery = `
            INSERT INTO EntryExitPoints (PointID, ParkingTollID, LocationCoordinates, IsActive)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
            const values = [pointID, parkingId, location, isActive];
            const result = await pool.query(createPointQuery, values);
            res.status(201).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    },
    updatePoint: async (req, res, next) => {
        try {
            const { pointId } = req.params;
            const { location, isActive } = req.body;

            const updatePointQuery = `
                UPDATE EntryExitPoints
                SET LocationCoordinates = $1, IsActive = $2
                WHERE PointID = $3 AND ParkingTollID = $4
                RETURNING *;
            `;

            const values = [location, isActive, pointId, await getParkingLotIdByEmployeeId(req.userId)];

            const result = await pool.query(updatePointQuery, values);

            if (result.rows.length === 0) {
                const error = new Error('Point not found or not associated with the parking lot or toll gate.');
                error.status = 404;
                throw error;
            }

            res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    },
    getPoints: async (req, res, next) => {
        try {
            const parkingId = await getParkingLotIdByEmployeeId(req.userId);

            const getPointsQuery = `
                SELECT * FROM EntryExitPoints
                WHERE ParkingLotID = $1;
            `;

            const result = await pool.query(getPointsQuery, [parkingId]);
            res.status(200).json(result.rows);
        } catch (error) {
            next(error);
        }
    },
    deletePoint: async (req, res, next) => {
        try {
            const { pointId } = req.params;

            const deletePointQuery = `
                DELETE FROM EntryExitPoints
                WHERE PointID = $1 AND ParkingTollID = $2
                RETURNING *;
            `;

            const values = [pointId, await getParkingLotIdByEmployeeId(req.userId)];

            const result = await pool.query(deletePointQuery, values);

            if (result.rows.length === 0) {
                const error = new Error('Point not found or not associated with the parking lot or toll gate.');
                error.status = 404;
                throw error;
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
};

module.exports = pointsController;