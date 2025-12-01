# skateswap-v3
SkateSwap - Skateboard Gear Marketplace Quick Start Guide Prerequisites Node.js (v14 or higher)

MySQL database

Cloudinary account (for image storage)

Installation Steps Install Dependencies

bash npm install Database Setup

Start MySQL service

Update database credentials in server.js:

javascript const db = mysql.createPool({ host: 'localhost', user: 'your_mysql_username', password: 'your_mysql_password', database: 'skateswap' }); Start Development Server

bash npm run dev Initialize Database Visit in your browser: http://localhost:5000/api/setup-db

Test Account Email: test@example.com

Password: password123

Project Structure text skateswap/ ├── server.js # Main server file ├── package.json # Dependencies └── public/ # Frontend files ├── index.html # Homepage ├── browse.html # Browse listings ├── post.html # Create listings ├── item.html # Item details ├── login.html # User login ├── register.html # User registration ├── dashboard.html # User dashboard ├── messages.html # Messaging system └── style.css # Main stylesheet API Endpoints Overview Authentication POST /api/register - Create new user

POST /api/login - User login

Listings GET /api/posts - Get all listings

GET /api/posts/:id - Get single listing

POST /api/posts - Create new listing

PUT /api/posts/:id - Update listing

DELETE /api/posts/:id - Delete listing

Images POST /api/upload-image - Upload images to Cloudinary

Messaging POST /api/conversations - Start conversation

GET /api/conversations/:userId - Get user conversations

POST /api/messages - Send message

GET /api/messages/:conversationId - Get conversation messages

User Management GET /api/users/:userId/posts - Get user's listings

GET /api/users/:userId/stats - Get user statistics

Key Features User registration and authentication

Create, edit, and delete skate gear listings

Image upload with drag-and-drop interface

Search and filter listings by category, location, keywords

Real-time messaging between buyers and sellers

User dashboard with personal statistics

Responsive design for mobile and desktop

Database Tables Users Table id, first_name, last_name, username, email, password, location, created_at

Posts Table id, seller_id, title, category, price, condition, description, location, image_urls, primary_image_url, created_at

Conversations Table id, post_id, buyer_id, seller_id, created_at, updated_at

Messages Table id, conversation_id, sender_id, message, is_read, created_at

Configuration Cloudinary Setup Add your Cloudinary credentials to server.js:

javascript cloudinary.config({ cloud_name: 'your_cloud_name', api_key: 'your_api_key', api_secret: 'your_api_secret' }); Environment Variables Create a .env file:

env PORT=5000 JWT_SECRET=your_jwt_secret CLOUDINARY_CLOUD_NAME=your_cloud_name CLOUDINARY_API_KEY=your_api_key CLOUDINARY_API_SECRET=your_api_secret Development Commands bash npm start # Production mode npm run dev # Development mode with auto-restart Troubleshooting Common Issues Database Connection Fails Verify MySQL service is running

Check database credentials in server.js

Ensure 'skateswap' database exists

Image Upload Issues Verify Cloudinary configuration

Check file size (max 5MB per image)

Ensure CORS is properly configured

Port Already in Use Change PORT in server.js (line 420)

Or kill process using port 5000

Authentication Problems Clear browser local storage

Check JWT token expiration

Verify password hashing

Default Categories Decks

Trucks

Wheels

Bearings

Complete Skateboards

Shoes

Protective Gear

Other

The application will be available at: http://localhost:5000
