const express = require('express');
const router = express.Router();
const adjacencyController  = require('../controllers/toll.adjacency.controller');
const isAuth = require("../middlewares/auth")

router.post('/', isAuth, adjacencyController.createTollGateAdjacency);

router.get('/', isAuth, adjacencyController.getTollGateAdjacencies);

router.get('/:edgeId', isAuth, adjacencyController.getTollGateAdjacencyById);

router.put('/:edgeId', isAuth, adjacencyController.updateTollGateAdjacencyById);

router.delete('/:edgeId', isAuth, adjacencyController.deleteTollGateAdjacencyById);

module.exports = router;