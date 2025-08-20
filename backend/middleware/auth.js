const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    // Debug logging
    console.log('Authorization check:', {
      userRole: req.user.role,
      requiredRoles: roles,
      userRoleType: typeof req.user.role,
      isAuthorized: roles.includes(req.user.role)
    });

    if (!req.user || !req.user.role) {
      return res.status(403).json({ 
        message: 'Access denied. User role not found.',
        debug: {
          hasUser: !!req.user,
          userRole: req.user?.role,
          requiredRoles: roles
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. You do not have permission to perform this action.',
        debug: {
          userRole: req.user.role,
          requiredRoles: roles,
          userRoleType: typeof req.user.role
        }
      });
    }
    next();
  };
};

module.exports = { auth, authorize }; 