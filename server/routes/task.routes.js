const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id/status', authorizeRoles('admin'), taskController.updateTaskStatus);

module.exports = router;
