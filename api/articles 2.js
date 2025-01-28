const express = require('express');
const router = express.Router();
const Article = require('../../models/Articles');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const auth = require('../../middleware/auth');
require('dotenv').config(); // For environment variables

// Initialize S3 Client
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Create multer storage
const storage = multer.memoryStorage(); // Use memory storage for handling file in memory
const upload = multer({ storage });

// Function to upload a file to S3
const uploadToS3 = async (file) => {
    const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET, // Your S3 bucket name
        Key: `articles/${Date.now()}_${file.originalname}`, // Path and filename in the S3 bucket
        Body: file.buffer, // The file's binary content
    };

    // Use AWS SDK v3's PutObjectCommand
    const command = new PutObjectCommand(uploadParams);

    try {
        const data = await s3.send(command); // Upload file to S3
        return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;
    } catch (err) {
        throw new Error('Error uploading file to S3: ' + err.message);
    }
};

// Create an article and upload the background image to S3
router.post('/create', upload.single('background_image'), async (req, res) => {
    try {
        let backgroundImageURL = null;

        if (req.file) {
            // Upload the background image to S3
            backgroundImageURL = await uploadToS3(req.file);
        }

        const newArticle = new Article({
            title: req.body.title,
            category: req.body.category,
            content: req.body.content,
            created_by: req.body.created_by,
            background_image: backgroundImageURL, // Store the S3 URL in DB
        });

        await newArticle.save();
        await newArticle.populate('created_by', 'username');
        res.json(newArticle);
    } catch (err) {
        console.error('Error creating article:', err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/', (req, res) => {
    Article.find()
        .then(articles => res.json(articles))
        .catch(err => res.status(400).json(err));
});

router.get('/:id', async (req, res) => {
    try {
      const article = await Article.findById(req.params.id)
        .populate({
          path: 'comments.user',
          select: 'username' // Populate only the username field
        })
        .populate({
          path: 'comments.replies.user',
          select: 'username' // Populate only the username field
        });
  
      if (!article) {
        return res.status(404).json({ msg: 'Article not found' });
      }
  
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

router.get('/category', async (req, res) => {
    const category = req.query.category;
    try {
        const articles = await Article.find({ category }).populate('created_by', 'username');
        res.json(articles);
    } catch (err) {
        console.error('Error fetching articles by category:', err.message);
        res.status(400).json({ error: err.message });
    }
});

router.post('/:id/comments', auth, async (req, res) => {
    try {
      const { content } = req.body;
      const userId = req.user._id;
  
      const article = await Article.findById(req.params.id);
      if (!article) {
        return res.status(404).json({ msg: 'Article not found' });
      }
  
      const newComment = {
        user: userId,
        content
      };
  
      article.comments.push(newComment);
      await article.save();
  
      // Populate user details for comments
      await article.populate({
        path: 'comments.user',
        select: 'username'
      });
  
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

  router.post('/:id/likes', auth, async (req, res) => {
    try {
      const userId = req.user.id;
  
      const article = await Article.findById(req.params.id);
      if (!article) {
        return res.status(404).json({ msg: 'Article not found' });
      }
  
      if (article.likes.some((like) => like.user.toString() === userId)) {
        return res.status(400).json({ msg: 'Article already liked' });
      }
  
      const newLike = {
        user: userId,
      };
  
      article.likes.push(newLike);
      await article.save();
      
      await article.populate('likes.user', 'username');
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/comments/:commentId/replies', auth, async (req, res) => {
    try {
      const { content } = req.body;
      const userId = req.user._id;
  
      const article = await Article.findById(req.params.id);
      if (!article) {
        return res.status(404).json({ msg: 'Article not found' });
      }
  
      const comment = article.comments.id(req.params.commentId);
      if (!comment) {
        return res.status(404).json({ msg: 'Comment not found' });
      }
  
      const newReply = {
        user: userId,
        content
      };
  
      comment.replies.push(newReply);
      await article.save();
  
      // Populate user details for replies
      await article.populate({
        path: 'comments.replies.user',
        select: 'username'
      });
  
      res.json(article);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
module.exports = router;
