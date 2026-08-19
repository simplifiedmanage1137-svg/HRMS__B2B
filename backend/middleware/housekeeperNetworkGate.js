// Express middleware form of evaluateNetworkGate — mount AFTER token verification
// (needs req.user.role) on any route surface Housekeepers actively use (e.g.
// /api/attendance), so a session that's already live gets cut off the moment the
// device leaves the allowlisted network, not just on next login.
const { evaluateNetworkGate } = require('../utils/housekeeperNetworkGate');

const housekeeperNetworkGateMiddleware = async (req, res, next) => {
    const role = req.user?.role || req.userRole;
    const userId = req.user?.employeeId || req.employeeId;

    const result = await evaluateNetworkGate(req, userId, role);
    if (result.decision === 'blocked') {
        return res.status(403).json({
            success: false,
            message: 'Please connect to company Wi-Fi for clock in.',
            code: 'IP_BLOCKED',
        });
    }
    next();
};

module.exports = housekeeperNetworkGateMiddleware;
