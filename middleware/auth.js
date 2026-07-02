const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token from Authorization header.
 * Attaches admin info to req.admin if valid.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * Optional auth - doesn't block request if no token, but attaches admin if present.
 * Used for routes that work for both public and admin (e.g., product list).
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.admin = decoded;
    } catch (error) {
      // Invalid token – just continue without admin
    }
  }

  // Also check X-User-Role header (for backward compatibility with frontend)
  if (!req.admin && req.headers['x-user-role'] === 'Admin') {
    req.isAdminRole = true;
  }

  next();
};

module.exports = { authMiddleware, optionalAuth };
