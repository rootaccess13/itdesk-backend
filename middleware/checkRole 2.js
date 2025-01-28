const jwt = require('jsonwebtoken');
const User = require('../routes/api/models/User');
const keys = require('../config/keys');

// Middleware to check if the user has the required role
const checkRole = (roles) => async (req, res, next) => {
  // Get the token from the request header
  const authHeader = req.header('Authorization');
  
  // Ensure the authorization header is present and correctly formatted
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Extract the token by removing 'Bearer ' prefix
  const token = authHeader.split(' ')[1];
  console.log(`Extracted Token: ${token}`);

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, keys.secretOrKey);
    req.user = decoded;
    console.log(`Decoded Token: ${JSON.stringify(decoded)}`);

    // Find the user by ID
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    console.log(`User found: ${JSON.stringify(user)}`);

    // Check if the user's role is allowed
    if (!roles.includes(user.role)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    console.error('Something went wrong with the auth middleware', err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = checkRole;
