const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); // Adjust path as needed

module.exports = function(passport) {
  passport.use(new GoogleStrategy({
    clientID: '36468434283-pj5p6ev61uasg63djvd4bv85ho4inm1r.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: '/auth/google/callback', // Adjust the callback URL based on your setup
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo', // Ensure this is correct
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if the user already exists in your database
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        // If user exists, return the user
        return done(null, user);
      } else {
        // If user doesn't exist, create a new user in your database
        const newUser = new User({
          googleId: profile.id,
          email: profile.emails[0].value, // Assuming the first email is the primary one
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          // Any other required fields
        });

        user = await newUser.save();
        return done(null, user);
      }
    } catch (err) {
      console.error(err);
      return done(err, null);
    }
  }
));

// Serialize user into session
passport.serializeUser((user, done) => {
  done(null, user.id); // Assuming 'user.id' is the unique identifier in your User model
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error(err);
    done(err, null);
  }
});

};