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

const adjacencyController = {
    createTollGateAdjacency: async (req, res, next) => {
        try {
            const { gateId1, gateId2, charges } = req.body;
            const tollGateId = await getParkingLotIdByEmployeeId(req.userId);
            const edgeId = uuid.v4();

            const createTollGateAdjacencyQuery = `
                INSERT INTO TollGateAdjacency (EdgeID, GateID1, GateID2, TollGateID, Charges)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;

            const values = [edgeId, gateId1, gateId2, tollGateId, charges];

            const result = await pool.query(createTollGateAdjacencyQuery, values);

            res.status(201).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    },

    getTollGateAdjacencies: async (req, res, next) => {
        try {
            const tollGateId = await getParkingLotIdByEmployeeId(req.userId);
            const getAllTollGateAdjacenciesQuery = 'SELECT * FROM TollGateAdjacency WHERE TollGateID = $1;';
            const result = await pool.query(getAllTollGateAdjacenciesQuery, [tollGateId]);
            res.status(200).json(result.rows);
        } catch (error) {
            next(error);
        }
    },

    getTollGateAdjacencyById: async (req, res, next) => {
        try {
            const { edgeId } = req.params;
            const tollGateId = await getParkingLotIdByEmployeeId(req.userId);

            const getTollGateAdjacencyQuery = 'SELECT * FROM TollGateAdjacency WHERE EdgeID = $1 AND TollGateID = $2;';
            const result = await pool.query(getTollGateAdjacencyQuery, [edgeId, tollGateId]);

            if (result.rows.length === 0) {
                res.status(404).json({ message: 'Toll gate adjacency not found.' });
            } else {
                res.status(200).json(result.rows[0]);
            }
        } catch (error) {
            next(error);
        }
    },

    updateTollGateAdjacencyById: async (req, res, next) => {
        try {
            const { edgeId } = req.params;
            const { gateId1, gateId2, charges } = req.body;
            const tollGateId = await getParkingLotIdByEmployeeId(req.userId);

            const updateTollGateAdjacencyQuery = `
                UPDATE TollGateAdjacency
                SET GateID1 = $1, GateID2 = $2, Charges = $3
                WHERE EdgeID = $4 AND TollGateID = $5
                RETURNING *;
            `;

            const values = [gateId1, gateId2, charges, edgeId, tollGateId];

            const result = await pool.query(updateTollGateAdjacencyQuery, values);

            if (result.rows.length === 0) {
                res.status(404).json({ message: 'Toll gate adjacency not found.' });
            } else {
                res.status(200).json(result.rows[0]);
            }
        } catch (error) {
            next(error);
        }
    },

    deleteTollGateAdjacencyById: async (req, res, next) => {
        try {
            const { edgeId } = req.params;
            const tollGateId = await getParkingLotIdByEmployeeId(req.userId);

            const deleteTollGateAdjacencyQuery = 'DELETE FROM TollGateAdjacency WHERE EdgeID = $1 AND TollGateID = $2 RETURNING *;';
            const result = await pool.query(deleteTollGateAdjacencyQuery, [edgeId, tollGateId]);

            if (result.rows.length === 0) {
                res.status(404).json({ message: 'Toll gate adjacency not found.' });
            } else {
                res.status(204).json({ message: 'Toll gate adjacency deleted successfully.' });
            }
        } catch (error) {
            next(error);
        }
    },
};

module.exports = adjacencyController;