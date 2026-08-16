const prisma = require("../config/prisma");
const { isValidObjectId } = require("../utils/validation");

/**
 * RBAC Middleware: Verify admin role from userId in request.
 * Checks query param `userId`, body `userId`, or body `createdBy`.
 * Returns 403 if user is not admin.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.body.userId || req.body.createdBy;
    
    if (!userId || !isValidObjectId(userId)) {
      return res.status(403).json({ success: false, error: "Admin authentication required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Insufficient permissions. Admin role required." });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    res.status(500).json({ success: false, error: "Authentication verification failed" });
  }
};

module.exports = { requireAdmin };
