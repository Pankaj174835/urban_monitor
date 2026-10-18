const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

// Protect all admin routes
router.use(authenticate, authorizeRoles('admin'));

router.get('/overview', adminController.getOverview);
router.put('/reports/:id/verify', adminController.verifyReport);
router.put('/reports/:id/priority', adminController.setPriority);
router.put('/reports/:id/assign', adminController.assignTeam);
router.put('/reports/:id/status', adminController.updateStatus);
router.put('/reports/:id/duplicate', adminController.markDuplicate);
router.post('/reports/:id/notes', adminController.addAdminNote);

module.exports = router;
