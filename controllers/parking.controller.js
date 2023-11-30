const pool = require('../database');
const uuid = require("uuid");
const pgFormat = require("pg-format");

const axios = require('axios');
const getUserDeviceTokens = async (userId) => {
    try {
        const query = 'SELECT Token FROM UserLogins WHERE UserID = $1';
        const result = await pool.query(query, [userId]);
        return result.rows.map((row) => row.token);
    } catch (error) {
        console.error('Error fetching user device tokens:', error.message);
    }
}

const sendNotificationToDevice = async (token, message, title) => {
    try {

        const firebaseFunctionUrl = 'https://us-central1-gatepay.cloudfunctions.net/sendNotification';

        const requestBody = {
            deviceToken: token,
            message,
            title,
        };

        await axios.post(firebaseFunctionUrl, requestBody);
    } catch (error) {
        console.error('Error sending notifications to device:', error.message, error.response.data);
    }
}

const sendNotificationToUser = async (userId, message, title) => {
    try {
        const userDeviceTokens = await getUserDeviceTokens(userId);
        userDeviceTokens.forEach(async (token) => {
            await sendNotificationToDevice(token, message, title);
        })
    } catch (error) {
        console.error('Error sending notifications to user:', error.message);
    }
}

const getTollInfoByGateId = async (gateId) => {
    const query = `SELECT T.ID, T.Type, T.Name, E.LocationCoordinates FROM EntryExitPoints E JOIN TollsAndParkingSpaces T ON E.ParkingTollID = T.ID WHERE E.PointID = $1;`;

    const result = await pool.query(query, [gateId]);

    if (result.rows.length === 0) {
        const error = new Error('Invalid gate ID.');
        error.status = 404;
        throw error;
    }

    return {
        parkingLotId: result.rows[0].id,
        type: result.rows[0].type,
        name: result.rows[0].name,
        location: result.rows[0].locationcoordinates
    };
};

const chargeUser = async (userId, tolParId, amount) => {
    const user = await pool.query('SELECT Balance FROM Users WHERE ID = $1', [userId]);

    if (user.rows.length === 0) {
        throw new Error('User not found.');
    }

    const userBalance = parseFloat(user.rows[0].balance);

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

    await sendNotificationToUser(userId, `Payment of Rs. ${amount} processed successfully`, `Payment successful`);

    return transactionId;
};

const dijkstra = async (graph, source, destination) => {
    let distance = {};
    let visited = {};

    for (const gateId in graph) {
        distance[gateId] = Infinity;
        visited[gateId] = false;
    }
    distance[source] = 0;

    for (let i = 0; i < Object.keys(graph).length - 1; i++) {
        const u = getMinDistanceVertex(distance, visited);
        visited[u] = true;
        for (const connection of graph[u]) {
            const v = connection.gateId2;
            const charges = connection.charges;
            const updatedCharges = (distance[u] * 1.0) + (charges * 1.0);
            if (!visited[v] && distance[u] !== Infinity && updatedCharges < distance[v]) {
                distance[v] = updatedCharges;
            }
        }
    }
    return distance[destination];
};

const getMinDistanceVertex = (distance, visited) => {
    let minDistance = Infinity;
    let minIndex = null;

    for (const gateId in distance) {
        if (!visited[gateId] && distance[gateId] <= minDistance) {
            minDistance = distance[gateId];
            minIndex = gateId;
        }
    }

    return minIndex;
};

const findShortestPathAndCalculateCost = async (sourceGateId, destinationGateId, tollGateID) => {
    const tollGateConnections = await pool.query('SELECT * FROM TollGateAdjacency WHERE TollGateID = $1', [tollGateID]);
    const graph = {};

    tollGateConnections.rows.forEach((connection) => {
        const { gateid1, gateid2, charges } = connection;

        if (!graph[gateid1]) {
            graph[gateid1] = [];
        }

        graph[gateid1].push({ gateId2: gateid2, charges });

        if (!graph[gateid2]) {
            graph[gateid2] = [];
        }

        graph[gateid2].push({ gateId2: gateid1, charges });
    });
    return await dijkstra(graph, sourceGateId, destinationGateId);
};



const parkingController = {
    assignParkingSpaceToVehicle: async (req, res, next) => {
        try {
            const { vehicleLicenseNo, gateId, action } = req.body;
            const vehicle = await pool.query('SELECT * FROM Vehicle WHERE VehicleNo = $1', [vehicleLicenseNo]);
            if (vehicle.rows.length === 0) {
                const error = new Error('Vehicle not registered.');
                error.status = 400;
                throw error;
            }

            const tollInfo = await getTollInfoByGateId(gateId);
            const parkTollId = tollInfo.parkingLotId;
            const type = tollInfo.type;
            const userId = vehicle.rows[0].userid;
            if (type === "Parking") {
                if (action === 'entry') {
                    const availableSpace = await pool.query('SELECT * FROM ParkingSpace WHERE ParkingLotID = $1 AND IsOccupied = FALSE LIMIT 1', [parkTollId]);
                    if (availableSpace.rows.length === 0) {
                        throw new Error('No available parking spaces');
                    }
                    const spaceID = availableSpace.rows[0].spaceid;
                    const entryTime = new Date();
                    await pool.query('UPDATE ParkingSpace SET IsOccupied = TRUE, VehicleID = $1 WHERE SpaceID = $2', [vehicle.rows[0].id, spaceID]);
                    const entryExitID = uuid.v4();
                    await pool.query('INSERT INTO VehicleEntryExit (EntryExitID, VehicleID, EntryTime, ParkingLotID, ParkingSpaceID) VALUES ($1, $2, $3, $4, $5)', [entryExitID, vehicle.rows[0].id, entryTime, parkTollId, spaceID]);
                    await sendNotificationToUser(userId, `You are assigned space with id : ${spaceID}`, `Welcome to ${tollInfo.name}`);
                    return res.json({
                        message: 'Parking space assigned successfully',
                        parkingSpaceID: spaceID,
                        entryExitID,
                        entryTime
                    });
                } else if (action === 'exit') {
                    const entryExitInfo = await pool.query('SELECT * FROM VehicleEntryExit WHERE VehicleID = $1 AND ExitTime IS NULL', [vehicle.rows[0].id]);

                    if (entryExitInfo.rows.length === 0) {
                        throw new Error('No matching entry found for the vehicle');
                    }

                    const exitTime = new Date();
                    const entryTime = new Date(entryExitInfo.rows[0].entrytime);
                    const timeDiffMillis = exitTime - entryTime;
                    const timeDiffHours = timeDiffMillis / (1000 * 60 * 60);

                    const parkingSpaceID = entryExitInfo.rows[0].parkingspaceid;

                    const parkingSpaceInfo = await pool.query('SELECT * FROM ParkingSpace WHERE SpaceID = $1', [parkingSpaceID]);

                    if (parkingSpaceInfo.rows.length === 0) {
                        throw new Error('Invalid parking space ID');
                    }

                    const parkingLotID = parkingSpaceInfo.rows[0].parkinglotid;
                    const chargesPerHour = parkingSpaceInfo.rows[0].chargesperhour;
                    const fixedCharges = parkingSpaceInfo.rows[0].fixedcharges;
                    const baseTime = parkingSpaceInfo.rows[0].basetime;

                    let totalCharges = (fixedCharges * 1.00);
                    if (timeDiffHours > baseTime) {
                        const additionalHours = Math.ceil(timeDiffHours - baseTime);
                        totalCharges += additionalHours * chargesPerHour;
                    }

                    const transactionId = await chargeUser(vehicle.rows[0].userid, parkingLotID, totalCharges);

                    await pool.query('UPDATE ParkingSpace SET IsOccupied = FALSE, VehicleID = NULL WHERE SpaceID = $1', [parkingSpaceID]);
                    await pool.query('UPDATE VehicleEntryExit SET ExitTime = $1, Charges = $2, TransactionID = $3 WHERE EntryExitID = $4', [exitTime, totalCharges, transactionId, entryExitInfo.rows[0].entryexitid]);

                    return res.json({
                        message: 'Parking exit processed successfully',
                        exitTime,
                        totalCharges,
                        transactionId
                    });
                } else {
                    const error = new Error('Invalid action. Use "entry" or "exit".');
                    error.status = 400;
                    throw error;
                }
            } else if (type === "Toll") {
                if (action === 'entry') {
                    const entryTime = new Date();
                    const entryID = uuid.v4();
                    await pool.query('INSERT INTO TollGateEntries (EntryID, VehicleID, EntryGateID, EntryTime) VALUES ($1, $2, $3, $4)',
                        [entryID, vehicle.rows[0].id, gateId, entryTime]);
                    await sendNotificationToUser(userId, `${vehicleLicenseNo} has entered from gate at ${tollInfo.location}`, `Welcome to ${tollInfo.name}`);
                    return res.json({
                        message: 'Toll gate entry recorded successfully',
                        entryID,
                        entryTime
                    });
                } else if (action === 'exit') {

                    const tollGateID = tollInfo.parkingLotId;
                    const entryInfo = await pool.query("SELECT * FROM TollGateEntries WHERE VehicleID = $1 AND ExitTime IS NULL", [vehicle.rows[0].id]);

                    if (entryInfo.rows.length === 0) {
                        throw new Error('No matching entry found for the vehicle');
                    }

                    const startNode = entryInfo.rows[0].entrygateid;
                    const totalCost = await findShortestPathAndCalculateCost(startNode, gateId, tollGateID);

                    const transactionId = await chargeUser(vehicle.rows[0].userid, tollGateID, totalCost);

                    const exitTime = new Date();

                    await pool.query('UPDATE TollGateEntries SET ExitGateID = $1, ExitTime = $2, TransactionID = $3 WHERE EntryID = $4',
                        [gateId, exitTime, transactionId, entryInfo.rows[0].entryid]);

                    return res.status(200).json({ msg: "Success", totalCost });
                } else {
                    const error = new Error('Invalid action. Use "entry" or "exit".');
                    error.status = 400;
                    throw error;
                }
            } else {
                const error = new Error('Invalid ID');
                error.status = 400;
                throw error;
            }
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
    },
    currentVehicleEntries: async (req, res, next) => {
        try {
            const userId = req.userId;
            const tollGateEntriesQuery = `
            SELECT
                tge.EntryID,
                tge.VehicleID,
                tge.EntryTime AS EntryTimestamp,
                v.VehicleNo,
                v.Manufacturer,
                v.Model,
                v.Color,
                eep.LocationCoordinates,
                tsp.Name AS TollGateName
            FROM
                TollGateEntries tge
            JOIN
                Vehicle v ON tge.VehicleID = v.ID
            JOIN
                EntryExitPoints eep ON tge.EntryGateID = eep.PointID
            JOIN
                TollsAndParkingSpaces tsp ON eep.ParkingTollID = tsp.ID
            WHERE
                v.UserID = $1
                AND tge.ExitTime IS NULL;
          `;

            const parkingEntriesQuery = `
            SELECT
    vee.EntryExitID,
    vee.VehicleID,
    vee.EntryTime AS EntryTimestamp,
    vee.ParkingLotID,
    vee.ParkingSpaceID,
    v.VehicleNo,
    v.Manufacturer,
    v.Model,
    v.Color,
    tp.Name AS ParkingLotName
FROM
    VehicleEntryExit vee
JOIN
    Vehicle v ON vee.VehicleID = v.ID
JOIN
    TollsAndParkingSpaces tp ON vee.ParkingLotID = tp.ID
WHERE
    v.UserID = $1
    AND vee.ExitTime IS NULL;
          `;

            const tollGateEntriesResult = await pool.query(tollGateEntriesQuery, [userId]);
            const parkingEntriesResult = await pool.query(parkingEntriesQuery, [userId]);

            const combinedResults = {
                tollGateEntries: tollGateEntriesResult.rows,
                parkingEntries: parkingEntriesResult.rows,
            };

            return res.json(combinedResults)
        } catch (error) {
            next(error);
        }
    }
}

module.exports = parkingController;