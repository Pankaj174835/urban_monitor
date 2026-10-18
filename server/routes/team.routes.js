const express = require('express');
const router = express.Router();
const teamController = require('../controllers/team.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.get('/', teamController.getAllTeams);
router.post('/', authenticate, authorizeRoles('admin'), teamController.createTeam);
router.put('/:id', authenticate, authorizeRoles('admin'), teamController.updateTeam);

module.exports = router;
