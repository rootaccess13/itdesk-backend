const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const path = require('path');
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
require('dotenv').config(); // To use environment variables

const users = require('./api/users');
const tickets = require('./api/tickets');
const assets = require('./api/assets');
const announcements = require('./api/announcements');
const incidentRequests = require('./api/incidentRequests');
const customerFeedbacks = require('./api/customerFeedbacks');
const passportConfig = require('./config/passport');
const articles = require('./api/articles');
const notifications = require('./api/notifications');

const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const corsOptions = {
  origin: '*',
  methods: 'GET, POST, PUT, DELETE',
  allowedHeaders: 'Content-Type, Authorization',
};

app.use(cors(corsOptions));


// MongoDB setup
const db = require('./config/keys').mongoURI;
mongoose.connect(db)
  .then(() => console.log('MongoDB successfully connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Initialize passport configuration
app.use(passport.initialize());
passportConfig(passport);

// AWS S3 Configuration
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new aws.S3();

// Multer configuration for file upload to S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET, // Specify your S3 bucket name
    acl: 'public-read', // Ensure the file is publicly accessible (or change as needed)
    key: function (req, file, cb) {
      cb(null, `uploads/${Date.now()}_${file.originalname}`); // Set the file name in the S3 bucket
    }
  }),
});

// API
app.use('/api/users', users);
app.use('/api/tickets', tickets);
app.use('/api/assets', assets);
app.use('/api/announcements', announcements);
app.use('/api/incidentRequests', incidentRequests);
app.use('/api/customerFeedbacks', customerFeedbacks);
app.use('/api/articles', articles);
app.use('/api/notifications', notifications);

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
  if (req.file) {
    // Send back the URL of the uploaded file
    res.status(200).json({
      message: 'File uploaded successfully!',
      fileUrl: req.file.location, // URL of the uploaded file on S3
    });
  } else {
    res.status(400).json({ message: 'File upload failed.' });
  }
});
// Serve static uploads (if needed)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set up the port and start the server
const PORT = process.env.PORT || 5001; // Use environment port or default to 5001
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export the app instance for use in bin/www or other files
module.exports = app;