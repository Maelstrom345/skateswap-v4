// server.js - SkateSwap Server with Cloudinary
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const app = express();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkkromchp',
  api_key: process.env.CLOUDINARY_API_KEY || '549629536846377',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'RAWBb7GluH_BO_LVFHEX7bjCEvw'
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static('public'));

// Database connection
const db = mysql.createPool({
  host: 'localhost',
  user: 'jaleny',
  password: 'Milky@734',
  database: 'skateswap',
  waitForConnections: true,
  connectionLimit: 10
});

// Test database connection
db.getConnection()
  .then(() => console.log('✅ Database connected successfully!'))
  .catch(err => console.log('❌ Database connection failed:', err.message));

// ==================== DATABASE SETUP ====================
app.get('/api/setup-db', async (req, res) => {
  try {
    console.log('🛠️ Setting up database tables...');
    
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');

    // Create posts table with image URLs
    await db.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        \`condition\` VARCHAR(50) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        image_urls JSON,
        primary_image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Posts table ready');

    // No need for separate images table anymore!

    // Check if we have any users
    const [users] = await db.execute('SELECT COUNT(*) as count FROM users');
    
    // Create test user if no users exist
    if (users[0].count === 0) {
      const testPassword = 'password123';
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      
      await db.execute(
        `INSERT INTO users (first_name, last_name, username, email, password, location) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Test', 'User', 'testuser', 'test@example.com', hashedPassword, 'Nairobi, Kenya']
      );
      console.log('✅ Test user created');
    }

    res.json({ 
      success: true, 
      message: 'Database is ready! 🎉',
      test_credentials: {
        email: 'test@example.com',
        password: 'password123'
      }
    });

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== USER REGISTRATION ====================
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, location } = req.body;

    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.execute(
      `INSERT INTO users (first_name, last_name, username, email, password, location) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, username, email, hashedPassword, location || null]
    );

    console.log(`✅ New user registered: ${username}`);

    res.json({ 
      success: true, 
      message: 'Registration successful! 🎉',
      userId: result.insertId 
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed' 
    });
  }
});

// ==================== USER LOGIN ====================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      process.env.JWT_SECRET || 'skateswap_secret_key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful! 🎉',
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed' 
    });
  }
});

// ==================== UPLOAD IMAGE TO CLOUDINARY ====================
app.post('/api/upload-image', async (req, res) => {
  try {
    const { image, fileName } = req.body;

    if (!image) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image data provided' 
      });
    }

    console.log('📸 Uploading image to Cloudinary...');

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(image, {
      folder: 'skateswap',
      quality: 'auto',
      fetch_format: 'auto',
      resource_type: 'image'
    });

    console.log('✅ Image uploaded to Cloudinary:', result.secure_url);

    res.json({
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== CREATE POST ====================
app.post('/api/posts', async (req, res) => {
  try {
    const { sellerId, title, category, price, condition, description, location, imageUrls, primaryImageUrl } = req.body;

    if (!sellerId || !title || !category || !price || !condition || !description || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    console.log('📝 Creating post with data:', {
      title,
      category,
      price,
      imageUrls,
      primaryImageUrl
    });

    // Ensure imageUrls is properly formatted as JSON array (accept string or array)
    let imageUrlsJson = null;
    if (imageUrls) {
      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        imageUrlsJson = JSON.stringify(imageUrls);
      } else if (typeof imageUrls === 'string' && imageUrls.trim() !== '') {
        // If a single URL string was provided, wrap it in an array
        imageUrlsJson = JSON.stringify([imageUrls]);
      }
    }

    // Insert post with image URLs
    const [postResult] = await db.execute(
      `INSERT INTO posts (seller_id, title, category, price, \`condition\`, description, location, image_urls, primary_image_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sellerId, 
        title, 
        category, 
        price, 
        condition, 
        description, 
        location,
        imageUrlsJson,  // This should be JSON string or null
        // Determine primary image safely whether imageUrls is array or string
        primaryImageUrl || (Array.isArray(imageUrls) ? imageUrls[0] : (typeof imageUrls === 'string' ? imageUrls : null)) || null
      ]
    );

    const postId = postResult.insertId;

    // Get the created post with seller info
    const [posts] = await db.execute(`
      SELECT p.*, u.username as seller_name, u.email as seller_email 
      FROM posts p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = ?
    `, [postId]);

    const post = posts[0];
    
    // Safely parse image_urls back to array for response
    if (post.image_urls) {
      try {
        if (typeof post.image_urls === 'string' && post.image_urls.startsWith('[')) {
          post.image_urls = JSON.parse(post.image_urls);
        } else if (typeof post.image_urls === 'string') {
          // single URL stored as string -> wrap as array
          post.image_urls = [post.image_urls];
        } else if (!Array.isArray(post.image_urls)) {
          post.image_urls = [];
        }
      } catch (err) {
        console.error('❌ Error parsing image_urls after insert:', err);
        post.image_urls = [];
      }
    } else {
      post.image_urls = [];
    }

    res.status(201).json({
      success: true,
      message: 'Post created successfully! 🎉',
      post: post
    });

  } catch (error) {
    console.error('❌ Post creation failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create post: ' + error.message 
    });
  }
});
// ==================== GET ALL POSTS ====================
app.get('/api/posts', async (req, res) => {
  try {
    console.log('📬 Fetching all posts...');
    
    const [posts] = await db.execute(`
      SELECT 
        p.*, 
        u.username as seller_name,
        u.email as seller_email,
        u.location as seller_location
      FROM posts p
      JOIN users u ON p.seller_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    console.log(`✅ Found ${posts.length} posts`);

    // SAFELY Parse image_urls for each post
    const processedPosts = posts.map(post => {
      let imageUrls = [];
      
      // Handle image_urls parsing safely
      if (post.image_urls) {
        try {
          // If it's already a string that looks like JSON, parse it
          if (typeof post.image_urls === 'string' && post.image_urls.startsWith('[')) {
            imageUrls = JSON.parse(post.image_urls);
          } 
          // If it's already an array (from previous successful inserts), use it directly
          else if (Array.isArray(post.image_urls)) {
            imageUrls = post.image_urls;
          }
          // If it's a single string URL, wrap it in an array
          else if (typeof post.image_urls === 'string') {
            imageUrls = [post.image_urls];
          }
        } catch (error) {
          console.error('❌ Error parsing image_urls for post', post.id, error);
          imageUrls = [];
        }
      }

      return {
        ...post,
        image_urls: imageUrls,
        primary_image_url: post.primary_image_url
      };
    });

    res.json({
      success: true,
      posts: processedPosts
    });

  } catch (error) {
    console.error('❌ Error fetching posts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch posts: ' + error.message 
    });
  }
});
// ==================== GET SINGLE POST ====================
app.get('/api/posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;

    const [posts] = await db.execute(`
      SELECT p.*, u.username as seller_name, u.email as seller_email 
      FROM posts p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = ?
    `, [postId]);

    if (posts.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    const post = posts[0];
    
    // Safely parse image_urls
    if (post.image_urls) {
      try {
        if (typeof post.image_urls === 'string' && post.image_urls.startsWith('[')) {
          post.image_urls = JSON.parse(post.image_urls);
        } else if (typeof post.image_urls === 'string') {
          post.image_urls = [post.image_urls];
        } else if (!Array.isArray(post.image_urls)) {
          post.image_urls = [];
        }
      } catch (err) {
        console.error('❌ Error parsing image_urls for single post:', err);
        post.image_urls = [];
      }
    } else {
      post.image_urls = [];
    }

    res.json({
      success: true,
      post: post
    });

  } catch (error) {
    console.error('❌ Error fetching post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch post' 
    });
  }
});
// ==================== UPDATE POST ====================
app.put('/api/posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { sellerId, title, category, price, condition, description, location, imageUrls, primaryImageUrl } = req.body;

    // Verify the user owns this post
    const [existingPosts] = await db.execute('SELECT seller_id FROM posts WHERE id = ?', [postId]);
    
    if (existingPosts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (existingPosts[0].seller_id !== sellerId) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this post' });
    }

    // Update post
    const [result] = await db.execute(
      `UPDATE posts 
       SET title = ?, category = ?, price = ?, \`condition\` = ?, description = ?, location = ?, image_urls = ?, primary_image_url = ?
       WHERE id = ?`,
      [
        title, category, price, condition, description, location,
        imageUrls ? JSON.stringify(imageUrls) : null,
        primaryImageUrl,
        postId
      ]
    );

    // Get updated post
    const [posts] = await db.execute(`
      SELECT p.*, u.username as seller_name, u.email as seller_email 
      FROM posts p 
      JOIN users u ON p.seller_id = u.id 
      WHERE p.id = ?
    `, [postId]);

    const post = posts[0];
    if (post.image_urls) {
      post.image_urls = JSON.parse(post.image_urls);
    }

    res.json({
      success: true,
      message: 'Post updated successfully!',
      post: post
    });

  } catch (error) {
    console.error('❌ Error updating post:', error);
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
});

// ==================== DELETE POST ====================
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { sellerId } = req.body;

    // Verify the user owns this post
    const [existingPosts] = await db.execute('SELECT seller_id FROM posts WHERE id = ?', [postId]);
    
    if (existingPosts.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (existingPosts[0].seller_id !== sellerId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    // Delete post
    await db.execute('DELETE FROM posts WHERE id = ?', [postId]);

    res.json({
      success: true,
      message: 'Post deleted successfully!'
    });

  } catch (error) {
    console.error('❌ Error deleting post:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
});

// Start or get conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { postId, buyerId, sellerId } = req.body;

    // Check if conversation already exists
    const [existing] = await db.execute(
      'SELECT * FROM conversations WHERE post_id = ? AND buyer_id = ?',
      [postId, buyerId]
    );

    let conversation;
    if (existing.length > 0) {
      conversation = existing[0];
    } else {
      // Create new conversation
      const [result] = await db.execute(
        'INSERT INTO conversations (post_id, buyer_id, seller_id) VALUES (?, ?, ?)',
        [postId, buyerId, sellerId]
      );
      conversation = { id: result.insertId, post_id: postId, buyer_id: buyerId, seller_id: sellerId };
    }

    res.json({
      success: true,
      conversation: conversation
    });

  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to start conversation' });
  }
});

// Send message
app.post('/api/messages', async (req, res) => {
  try {
    const { conversationId, senderId, message } = req.body;

    if (!message.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const [result] = await db.execute(
      'INSERT INTO messages (conversation_id, sender_id, message) VALUES (?, ?, ?)',
      [conversationId, senderId, message.trim()]
    );

    // Update conversation updated_at
    await db.execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    // Get the created message with sender info
    const [messages] = await db.execute(`
      SELECT m.*, u.username as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE m.id = ?
    `, [result.insertId]);

    res.json({
      success: true,
      message: messages[0]
    });

  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Get conversations for user
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const [conversations] = await db.execute(`
      SELECT 
        c.*,
        p.title as post_title,
        p.price as post_price,
        p.primary_image_url as post_image,
        seller.username as seller_name,
        buyer.username as buyer_name,
        (SELECT message FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      JOIN posts p ON c.post_id = p.id
      JOIN users seller ON c.seller_id = seller.id
      JOIN users buyer ON c.buyer_id = buyer.id
      WHERE c.seller_id = ? OR c.buyer_id = ?
      ORDER BY c.updated_at DESC
    `, [userId, userId]);

    res.json({
      success: true,
      conversations: conversations
    });

  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
});

// Get messages for conversation
app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    const [messages] = await db.execute(`
      SELECT m.*, u.username as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `, [conversationId]);

    // Mark messages as read
    await db.execute(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE',
      [conversationId, req.query.currentUserId]
    );

    res.json({
      success: true,
      messages: messages
    });

  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// Get user's posts
app.get('/api/users/:userId/posts', async (req, res) => {
  try {
    const userId = req.params.userId;

    const [posts] = await db.execute(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM conversations WHERE post_id = p.id) as conversation_count
      FROM posts p 
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `, [userId]);

    // Parse image_urls safely (handle both JSON arrays and plain URLs)
    const processedPosts = posts.map(post => {
      let imageUrls = [];
      try {
        if (post.image_urls) {
          if (typeof post.image_urls === 'string' && post.image_urls.startsWith('[')) {
            imageUrls = JSON.parse(post.image_urls);
          } else if (typeof post.image_urls === 'string') {
            imageUrls = [post.image_urls];
          } else if (Array.isArray(post.image_urls)) {
            imageUrls = post.image_urls;
          }
        }
      } catch (error) {
        console.error('Error parsing image_urls for post', post.id, error);
        if (typeof post.image_urls === 'string') {
          imageUrls = [post.image_urls];
        } else {
          imageUrls = [];
        }
      }
      return {
        ...post,
        image_urls: imageUrls
      };
    });

    res.json({
      success: true,
      posts: processedPosts
    });

  } catch (error) {
    console.error('❌ Error fetching user posts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user posts' });
  }
});

// ==================== GET USER STATS ====================
app.get('/api/users/:userId/stats', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get user's post count
    const [postCount] = await db.execute(
      'SELECT COUNT(*) as count FROM posts WHERE seller_id = ?',
      [userId]
    );

    // Get user's conversation count
    const [convCount] = await db.execute(
      'SELECT COUNT(*) as count FROM conversations WHERE seller_id = ? OR buyer_id = ?',
      [userId, userId]
    );

    // Get total value of user's listings
    const [totalValue] = await db.execute(
      'SELECT COALESCE(SUM(price), 0) as total FROM posts WHERE seller_id = ?',
      [userId]
    );

    res.json({
      success: true,
      stats: {
        postCount: postCount[0].count,
        conversationCount: convCount[0].count,
        totalValue: parseFloat(totalValue[0].total).toFixed(2)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user stats' 
    });
  }
});

// ==================== GET COMMUNITY STATS ====================
app.get('/api/stats/community', async (req, res) => {
  try {
    // Get total listings count
    const [listingsCount] = await db.execute('SELECT COUNT(*) as count FROM posts');
    
    // Get total users count
    const [usersCount] = await db.execute('SELECT COUNT(*) as count FROM users');
    
    // Get recent activity (posts from last 7 days)
    const [recentActivity] = await db.execute(`
      SELECT COUNT(*) as count FROM posts 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    res.json({
      success: true,
      stats: {
        totalListings: listingsCount[0].count,
        totalUsers: usersCount[0].count,
        recentActivity: recentActivity[0].count
      }
    });

  } catch (error) {
    console.error('❌ Error fetching community stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch community stats' 
    });
  }
});

// ==================== GET TOTAL USERS COUNT ====================
app.get('/api/stats/users', async (req, res) => {
  try {
    const [usersCount] = await db.execute('SELECT COUNT(*) as count FROM users');
    
    res.json({
      success: true,
      count: usersCount[0].count
    });
  } catch (error) {
    console.error('❌ Error fetching users count:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users count' 
    });
  }
});

// ==================== CREATE SAMPLE POSTS ====================
app.post('/api/create-sample-posts', async (req, res) => {
  try {
    // Get the test user
    const [users] = await db.execute('SELECT id FROM users WHERE email = ?', ['test@example.com']);
    
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'No test user found' });
    }

    const testUserId = users[0].id;

    // Sample posts with placeholder image URLs
    const samplePosts = [
      {
        title: 'Santa Cruz Classic Dot Deck',
        category: 'decks',
        price: 65.00,
        condition: 'excellent',
        description: 'Classic Santa Cruz deck in great condition. Lightly used, no cracks or chips.',
        location: 'Nairobi, Kenya',
        image_urls: ['https://images.unsplash.com/photo-1547447138-c45bca6f0d3a?w=400&h=300&fit=crop'],
        primary_image_url: 'https://images.unsplash.com/photo-1547447138-c45bca6f0d3a?w=400&h=300&fit=crop'
      },
      {
        title: 'Independent Stage 11 Trucks',
        category: 'trucks',
        price: 45.00,
        condition: 'good',
        description: 'Solid trucks, great for street skating. Some wear but fully functional.',
        location: 'Nairobi, Kenya',
        image_urls: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop'],
        primary_image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop'
      },
      {
        title: 'Spitfire Formula Four Wheels',
        category: 'wheels',
        price: 35.00,
        condition: 'like-new',
        description: 'Hardly used Spitfire wheels. Perfect for smooth rides.',
        location: 'Nairobi, Kenya',
        image_urls: ['https://images.unsplash.com/photo-1547447138-c45bca6f0d3a?w=400&h=300&fit=crop'],
        primary_image_url: 'https://images.unsplash.com/photo-1547447138-c45bca6f0d3a?w=400&h=300&fit=crop'
      }
    ];

    // Insert sample posts
    for (const post of samplePosts) {
      await db.execute(
        `INSERT INTO posts (seller_id, title, category, price, \`condition\`, description, location, image_urls, primary_image_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testUserId, 
          post.title, 
          post.category, 
          post.price, 
          post.condition, 
          post.description, 
          post.location,
          JSON.stringify(post.image_urls),
          post.primary_image_url
        ]
      );
      console.log(`✅ Created post: ${post.title}`);
    }

    res.json({
      success: true,
      message: `Created ${samplePosts.length} sample posts!`,
      posts: samplePosts
    });

  } catch (error) {
    console.error('❌ Error creating sample posts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEBUG ENDPOINTS ====================
app.get('/api/debug/posts', async (req, res) => {
  try {
    const [posts] = await db.execute('SELECT * FROM posts');
    
    // Parse image_urls for debugging
    const debugPosts = posts.map(post => ({
      ...post,
      image_urls: post.image_urls ? JSON.parse(post.image_urls) : null
    }));

    res.json({
      success: true,
      posts: debugPosts,
      total: posts.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Debug endpoint to check table structure
app.get('/api/debug/posts-structure', async (req, res) => {
  try {
    const [columns] = await db.execute("DESCRIBE posts");
    const [sampleData] = await db.execute("SELECT * FROM posts LIMIT 1");
    
    res.json({
      success: true,
      columns: columns,
      sample_data: sampleData[0] || 'No data'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n✨✨✨ SKATESWAP SERVER STARTED ✨✨✨');
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Initialize database: http://localhost:${PORT}/api/setup-db`);
  console.log(`📝 Create sample posts: http://localhost:${PORT}/api/create-sample-posts`);
  console.log(`🏠 Homepage: http://localhost:${PORT}/index.html`);
  console.log('💡 Use test credentials: test@example.com / password123\n');
});