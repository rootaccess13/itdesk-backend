import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from 'passport';
import aws from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { createServer } from '@vercel/node';  // This is required to make it serverless

// Import your routes from the api folder
import users from './users';
import tickets from './tickets';
import assets from './assets';
import announcements from './announcements';
import incidentRequests from './incidentRequests';
import customerFeedbacks from './customerFeedbacks';
import articles from './articles';
import notifications from './notifications';
import passportConfig from '../config/passport'; // Assuming passport config is in config/

require('dotenv').config(); // To load environment variables

// Initialize the express app
const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// MongoDB setup
const db = process.env.MONGO_URI;
mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB successfully connected'))
  .catch(err => console.log(err));

// Initialize passport
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
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      cb(null, `uploads/${Date.now()}_${file.originalname}`);
    }
  }),
});

// Set up API routes
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
    res.status(200).json({
      message: 'File uploaded successfully!',
      fileUrl: req.file.location,
    });
  } else {
    res.status(400).json({ message: 'File upload failed.' });
  }
});

// Export the Express app as a serverless function using Vercel
export default createServer(app);
