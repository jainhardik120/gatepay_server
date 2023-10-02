const crypto = require("crypto")
const pool = require('../database');
const instance = require("../razorpay")
const uuid = require("uuid");
const pgFormat = require("pg-format");

const parkingController = {
    assignParkingSpaceToVehicle: async (req, res, next) => {
        try {
            const { parkingLotID, vehicleLicenseNo } = req.body;
            const vehicle = await pool.query('SELECT * FROM Vehicle WHERE VehicleNo = $1', [vehicleLicenseNo]);
            if (vehicle.rows.length === 0) {
                throw new Error('Vehicle not found');
            }
            const parkingLot = await pool.query('SELECT * FROM TollsAndParkingSpaces WHERE ID = $1', [parkingLotID]);
            if (parkingLot.rows.length === 0) {
                throw new Error('Parking lot not found');
            }
            const availableSpace = await pool.query('SELECT * FROM ParkingSpace WHERE ParkingLotID = $1 AND IsOccupied = FALSE LIMIT 1', [parkingLotID]);
            if (availableSpace.rows.length === 0) {
                throw new Error('No available parking spaces');
            }
            const spaceID = availableSpace.rows[0].spaceid;
            const entryTime = new Date();
            await pool.query('UPDATE ParkingSpace SET IsOccupied = TRUE, VehicleID = $1 WHERE SpaceID = $2', [vehicle.rows[0].id, spaceID]);
            const entryExitID = uuid.v4();
            await pool.query('INSERT INTO VehicleEntryExit (EntryExitID, VehicleID, EntryTime, ParkingLotID, ParkingSpaceID) VALUES ($1, $2, $3, $4, $5)', [entryExitID, vehicle.rows[0].id, entryTime, parkingLotID, spaceID]);
            res.json({
                message: 'Parking space assigned successfully',
                parkingSpaceID: spaceID,
                entryExitID,
                entryTime
            });
        } catch (error) {
            next(error);
        }
    },
    createParkingSpaces: async (req, res, next) => {
        try {
            const employeeId = req.userId;
            const employeeResult = await pool.query(
                'SELECT e.ParkingTollID, t.Type FROM EmployeeAuthentication e JOIN TollsAndParkingSpaces t ON e.ParkingTollID = t.ID WHERE e.EmployeeID = $1;',
                [employeeId]
            );
            if (employeeResult.rows.length === 0) {
                throw new Error('Employee not found');
            }
            const parkingTollType = employeeResult.rows[0].type;
            const parkingTollId = employeeResult.rows[0].parkingtollid;
            if (parkingTollType === 'TollGate') {
                throw new Error('Toll gates do not have parking spaces');
            }
            const { parkingSpaces } = req.body;
            if (!parkingSpaces || !Array.isArray(parkingSpaces) || parkingSpaces.length === 0) {
                throw new Error('Invalid or empty parking spaces array');
            }
            const parkingSpaceValues = parkingSpaces.map((space) => [
                uuid.v4(),
                parkingTollId,
                false, 
                null,
                space.floor,
                space.chargesPerHour,
                space.fixedCharges,
                space.baseTime,
            ]);

            const insertQuery = pgFormat(
                'INSERT INTO ParkingSpace (SpaceID, ParkingLotID, IsOccupied, VehicleID, Floor, ChargesPerHour, FixedCharges, BaseTime) VALUES %L',
                parkingSpaceValues
            );

            await pool.query(insertQuery);
            res.status(201).json({ message: 'Parking spaces inserted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = parkingController;