const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const keys = require('../config/keys');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {sendAccountVerification} = require('../middleware/mailer/mailer');
const router = express.Router();


router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect home or send response as needed
    res.redirect('/');
  }
);
// Registration Route
router.post('/register', async (req, res) => {
  try {
    const {
      googleId,
      firstName,
      lastName,
      username,
      email,
      phoneNumber,
      idNumber, // Added ID Number
      password,
      role = 'user' // Default role if not provided
    } = req.body;

    // Check for existing email
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ email: 'Email already exists' });
    }

    // Check for existing username
    user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ username: 'Username already exists' });
    }

    // Check for existing ID number (if it's meant to be unique)
    user = await User.findOne({ idNumber });
    if (user) {
      return res.status(400).json({ idNumber: 'ID Number already exists' });
    }

    // Create new user object
    const newUser = new User({
      googleId: googleId || null,
      firstName,
      lastName,
      username,
      email,
      phoneNumber,
      idNumber,
      password,
      role,
      isVerified: false, // Assuming you want to track verification status
      status: 'pending' // For admin confirmation as per frontend message
    });

    // If not a Google OAuth user, hash the password
    if (!googleId) {
      const salt = await bcrypt.genSalt(10);
      newUser.password = await bcrypt.hash(password, salt);
    }

    // Send verification email
    await sendAccountVerification(newUser.email);

    // Save the user
    const savedUser = await newUser.save();

    // Return success response
    res.status(201).json({
      message: 'Registration successful! Please wait for administrator confirmation.',
      user: {
        id: savedUser._id,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        username: savedUser.username,
        email: savedUser.email,
        phoneNumber: savedUser.phoneNumber,
        idNumber: savedUser.idNumber,
        role: savedUser.role,
        status: savedUser.status
      }
    });

  } catch (err) {
    console.error('Registration error:', err);

    // Handle duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        [field]: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
      });
    }

    // Handle other errors
    res.status(500).json({ 
      error: 'Server error occurred during registration',
      details: err.message 
    });
  }
});

router.post('/login', (req, res) => {
  const { email, password, googleId } = req.body;

  if (googleId) {
    // Handle Google login
    User.findOne({ googleId }).then(user => {
      if (!user) {
        return res.status(404).json({ message: 'Google user not found' });
      }
      // Check if user is confirmed
      if (!user.is_confirmed) {
        return res.status(403).json({ message: 'User not confirmed. Please contact the administrator.' });
      }
      if (!user.is_active){
        return res.status(403).json({ message: 'User not active. Please contact the administrator.' });
      }

      const payload = { id: user.id, name: user.username }; // Use 'username' for the name

      jwt.sign(
        payload,
        keys.secretOrKey,
        { expiresIn: 31556926 }, // 1 year in seconds
        (err, token) => {
          if (err) throw err;
          res.json({
            success: true,
            token: 'Bearer ' + token
          });
        }
      );
    });
  } else {
    // Handle normal login
    User.findOne({ email }).then(user => {
      if (!user) {
        return res.status(404).json({ email: 'Email not found' });
      }
      // Check if user is confirmed
      if (!user.is_confirmed) {
        return res.status(403).json({ message: 'User not confirmed. Please contact the administrator.' });
      }
      if (!user.is_active){
        return res.status(403).json({ message: 'User not active. Please contact the administrator.' });
      }

      bcrypt.compare(password, user.password).then(isMatch => {
        if (isMatch) {
          const payload = { id: user.id, name: user.username }; // Use 'username' for the name

          jwt.sign(
            payload,
            keys.secretOrKey,
            { expiresIn: 31556926 }, // 1 year in seconds
            (err, token) => {
              if (err) throw err;
              res.json({
                success: true,
                token: 'Bearer ' + token
              });
            }
          );
        } else {
          return res.status(400).json({ password: 'Password incorrect' });
        }
      });
    });
  }
});

router.get('/me', auth, async (req, res) => {
  res.send(req.user);
});

// Confirm User Route (only accessible by administrator)
router.put('/confirm/:id', auth, checkRole(['administrator']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.is_confirmed = true;
    user.is_active = true;
    await user.save();

    res.json({ msg: 'User confirmed successfully', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Decline User Route (only accessible by administrator)
router.put('/decline/:id', auth, checkRole(['administrator']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ msg: 'User declined and deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
// Fetch all confirmed users
router.get('/confirmed', auth, checkRole(['administrator']), async (req, res) => {
  try {
    const confirmedUsers = await User.find({ is_confirmed: true }).limit(10);
    console.log(confirmedUsers);
    res.json(confirmedUsers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

//Fetch all unconfirmed users
router.get('/', auth, checkRole(['administrator']), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const users = await User.find({ is_confirmed: false }).select('-password').skip(skip).limit(limit);
    const totalUsers = await User.countDocuments({ is_confirmed: false });

    res.json({
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/manage', auth, checkRole(['administrator']), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status; // Get the status from query params
  const skip = (page - 1) * limit;

  let filterStatus;
  if (status === "active") {
    filterStatus = true;
  } else if (status === "inactive") {
    filterStatus = false;
  }

  try {
    const filter = { is_confirmed: true };
    if (status) {
      filter.is_active = filterStatus;
    }
    
    const users = await User.find(filter).select('-password').skip(skip).limit(limit);
    const totalUsers = await User.countDocuments(filter);

    res.json({
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Edit user by ID
router.put('/manage/edit/:id', auth, checkRole(['administrator']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const { firstName, lastName, username, email, phoneNumber, role, is_confirmed, is_active } = req.body;
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.username = username || user.username;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.role = role || user.role;
    user.is_confirmed = is_confirmed !== undefined ? is_confirmed : user.is_confirmed;
    user.is_active = is_active !== undefined ? is_active : user.is_active;

    await user.save();

    res.json({ msg: 'User updated successfully', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;
