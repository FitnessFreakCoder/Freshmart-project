/** 
 * FreshMart Backend Server with MongoDB Atlas
 * 
 * INSTALLATION:
 * 1. npm install express mongoose cors dotenv bcrypt jsonwebtoken multer
 * 2. Create .env file with MONGODB_URI
 * 3. Run: node server.cjs
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
require('dotenv').config();
const helmet = require('helmet');
const { doubleCsrf } = require('csrf-csrf');
const http = require('http');
const { Server } = require('socket.io');

const { User, Product, Coupon, Order } = require('./models.cjs');
const {
  validate,
  productSchema,
  orderSchema,
  couponSchema,
  staffSchema,
  idSchema,
  codeSchema
} = require('./validation.cjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
  }
});

// --- SOCKET.IO CONNECTION HANDLER ---
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 1. CORS (Must be first to handle pre-flight requests)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
}));

// 2. SECURITY HEADERS
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 3. BODY PARSING & COOKIES
app.use(express.json());
app.use(cookieParser());

// 4. STATIC FILES
app.use('/uploads', express.static('uploads'));

// JWT Secrets
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';

// 5. CSRF PROTECTION
const {
  doubleCsrfProtection,
  generateToken
} = doubleCsrf({
  getSecret: () => JWT_SECRET,
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// CSRF Token Endpoint
app.get('/api/csrf-token', (req, res) => {
  try {
    const csrfToken = generateToken(req, res);
    res.json({ csrfToken });
  } catch (err) {
    console.error('CSRF Gen Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// CSRF Error Handler
const csrfErrorHandler = (error, req, res, next) => {
  if (error === 'invalid csrf token') {
    console.log('❌ CSRF validation failed for:', req.method, req.url);
    return res.status(403).json({
      message: 'CSRF Validation Failed',
      code: 'CSRF_ERROR'
    });
  }
  next(error);
};

// --- MONGODB CONNECTION ---
console.log('🔄 Connecting to MongoDB Atlas...');
console.log('   URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'NOT SET');

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  retryWrites: true,
})
  .then(() => console.log('✅ Connected to MongoDB Atlas successfully!'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.error('');
    console.error('🔧 TROUBLESHOOTING:');
    console.error('   1. Check your MONGODB_URI in .env file');
    console.error('   2. Whitelist your IP in MongoDB Atlas:');
    console.error('      → Go to MongoDB Atlas → Network Access → Add IP Address');
    console.error('      → Add your current IP or use 0.0.0.0/0 for testing');
    console.error('   3. Check your database user password is correct');
    console.error('');
  });

// --- SEED DEFAULT ADMIN ---
const seedAdmin = async () => {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'SID';
    const adminPassword = process.env.ADMIN_PASSWORD || 'S!dd@3173';

    const existingAdmin = await User.findOne({ role: 'ADMIN' });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await User.create({
        username: adminUsername,
        email: 'admin@freshmart.com',
        passwordHash,
        role: 'ADMIN'
      });
      console.log(`✅ Default admin created: ${adminUsername}`);
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  }
};

// Run after connection
mongoose.connection.once('open', seedAdmin);

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log(`[Auth] No token. URL: ${req.url}`);
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token verification failed:', err.message);
      return res.sendStatus(401);
    }
    req.user = user;
    next();
  });
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};

// --- IMAGE UPLOAD ---
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
  }
});

// =====================
// AUTH ROUTES
// =====================

// 1. REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, passwordHash });
    await user.save();

    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        mobileNumber: user.mobileNumber,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GOOGLE LOGIN
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1022561909186-33i8psb5samvvb42kmve5gs4i3vgulhu.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.post('/api/google-login', async (req, res) => {
  const { token } = req.body;

  console.log('🔹 Google Login Request received');
  console.log('   Token (first 20 chars):', token.substring(0, 20) + '...');

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    console.log('✅ Google Token Verified Successfully');
    console.log('   Payload Audience:', payload.aud);
    console.log('   Payload Email:', payload.email);
    console.log('   Payload Expiry:', new Date(payload.exp * 1000).toISOString());
    console.log('   Server Time:   ', new Date().toISOString());

    const { email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      console.log('   User not found, creating new user...');
      const passwordHash = await bcrypt.hash('GOOGLE_OAUTH_USER_' + Date.now(), 10);
      user = new User({
        username: name,
        email,
        passwordHash,
        role: 'USER',
        profilePicture: picture
      });
      await user.save();
      console.log('   New user created:', user._id);
    } else {
      console.log('   User found:', user._id);
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      mobileNumber: user.mobileNumber,
      profilePicture: user.profilePicture
    });

  } catch (err) {
    console.error('❌ Google Login Verification Failed:');
    console.error('   Error Message:', err.message);
    console.error('   Server Time:', new Date().toISOString());
    if (err.message.includes('Token used too late')) {
      console.error('   ⚠️ CLOCK SKEW DETECTED! server time may be behind or ahead of Google time.');
    }
    res.status(400).json({ message: 'Invalid Google Token', error: err.message });
  }
});

// 4. GOOGLE AUTH (Legacy)
app.post('/api/auth/google', async (req, res) => {
  console.log('🔹 Google Auth Request:', req.body.email);
  try {
    const { email, name, picture } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      const passwordHash = await bcrypt.hash('GOOGLE_OAUTH_USER_' + Date.now(), 10);
      user = new User({
        username: name,
        email,
        passwordHash,
        role: 'USER',
        profilePicture: picture
      });
      await user.save();
    } else {
      if (picture && user.profilePicture !== picture) {
        user.profilePicture = picture;
        user.username = name;
        await user.save();
      }
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. REFRESH TOKEN
app.post('/api/refresh-token', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      accessToken: newAccessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        mobileNumber: user.mobileNumber,
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// 6. LOGOUT
app.post('/api/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

// 7. RESET PASSWORD
app.put('/api/auth/reset-password', async (req, res) => {
  try {
    const { identifier, newPassword } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// PRODUCT ROUTES
// =====================

// GET ALL PRODUCTS
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products.map(p => ({
      id: p._id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      unit: p.unit,
      stock: p.stock,
      category: p.category,
      imageUrl: p.imageUrl,
      bulkRule: p.bulkRule
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD PRODUCT (Admin) - NO CSRF VALIDATION
app.post('/api/admin/products', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), upload.single('image'), validate({ body: productSchema }), async (req, res) => {
  console.log('🔹 Add Product Request');
  console.log('   Body:', req.body);
  try {
    const { name, price, originalPrice, unit, stock, category, imageUrl } = req.body;
    const bulkRule = req.body.bulkRule;

    const finalImageUrl = req.file ? `/uploads/${req.file.filename}` : (imageUrl || '');

    const product = new Product({
      name,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      unit,
      stock: Number(stock),
      category,
      imageUrl: finalImageUrl,
      bulkRule
    });

    await product.save();
    res.json({
      message: 'Product added',
      product: {
        id: product._id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        unit: product.unit,
        stock: product.stock,
        category: product.category,
        imageUrl: product.imageUrl,
        bulkRule: product.bulkRule
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE PRODUCT (Admin) - NO CSRF VALIDATION
app.put('/api/admin/products/:id', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), upload.single('image'), validate({ body: productSchema, params: idSchema }), async (req, res) => {
  try {
    const { name, price, originalPrice, unit, stock, category, imageUrl } = req.body;
    const bulkRule = req.body.bulkRule;

    const updateData = {
      name,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      unit,
      stock: Number(stock),
      category,
      bulkRule
    };

    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    } else if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Product updated',
      product: {
        id: product._id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        unit: product.unit,
        stock: product.stock,
        category: product.category,
        imageUrl: product.imageUrl,
        bulkRule: product.bulkRule
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE PRODUCT (Admin) - NO CSRF VALIDATION
app.delete('/api/admin/products/:id', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), validate({ params: idSchema }), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE CATEGORY (Admin) - Bulk Update
app.delete('/api/admin/categories/:category', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const { category } = req.params;
    // Update all products with this category to 'Uncategorized'
    const result = await Product.updateMany(
      { category: category },
      { category: 'Uncategorized' }
    );

    res.json({
      message: `Category '${category}' deleted`,
      updatedCount: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// ORDER ROUTES
// =====================

// PLACE ORDER - NO CSRF VALIDATION
app.post('/api/orders', authenticateToken, validate({ body: orderSchema }), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, discount, couponCodes, deliveryCharge, location, mobileNumber, username } = req.body;
    const orderId = `ORD-${Date.now()}`;

    const calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const validDiscount = discount || 0;
    const validDelivery = deliveryCharge || 0;
    const calculatedFinal = calculatedTotal - validDiscount + validDelivery;

    if (couponCodes && couponCodes.length > 0) {
      await Coupon.updateMany(
        { code: { $in: couponCodes } },
        { $addToSet: { usedBy: req.user.id } },
        { session }
      );
    }

    const order = new Order({
      orderId: orderId,
      user: req.user.id,
      username: username || req.user.username,
      mobileNumber,
      items: items.map(i => ({
        productId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity
      })),
      totalAmount: calculatedTotal,
      discountApplied: validDiscount,
      deliveryCharge: validDelivery,
      finalAmount: calculatedFinal,
      location,
      status: 'Pending'
    });

    await order.save({ session });

    for (const item of items) {
      await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } }, { session });
    }

    if (mobileNumber) {
      const rawMobile = mobileNumber.replace('+977-', '');
      await User.findByIdAndUpdate(req.user.id, { mobileNumber: rawMobile }, { session });
    }

    await session.commitTransaction();

    // --- SOCKET.IO EMIT ---
    io.to('admin_room').to('staff_room').emit('newOrderNotification', {
      message: 'New order received!',
      order: {
        id: orderId, // Map to frontend expected format
        userId: order.user,
        username: username || req.user.username,
        mobileNumber: mobileNumber,
        items: items.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity
        })),
        total: calculatedTotal,
        discount: validDiscount,
        deliveryCharge: validDelivery,
        finalTotal: calculatedFinal,
        status: 'Pending',
        location: location,
        createdAt: order.createdAt
      }
    });

    res.json({
      id: orderId,
      status: 'Pending',
      createdAt: order.createdAt
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Order creation error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// GET ORDERS (User & Admin) - FIXED QUERY LOGIC
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    let query = {};

    console.log('🔍 GET /api/orders called');
    console.log('   User ID from token:', req.user.id);
    console.log('   User role:', req.user.role);
    console.log('   Query param userId:', req.query.userId);

    // If a specific user ID is requested via query param
    if (req.query.userId) {
      // If user is not admin/staff, they can ONLY request their own ID
      if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF' && req.query.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized to view other users' orders" });
      }
      // Use the string ID directly - Mongoose will convert it
      query = { user: req.query.userId };
    }
    // Default behavior: If not admin/staff, force filter by own ID
    else if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
      query = { user: req.user.id };
    }
    // If Admin/Staff and NO userId param, return ALL orders

    console.log('   MongoDB query:', JSON.stringify(query));

    const orders = await Order.find(query).sort({ createdAt: -1 });
    console.log('   Found orders:', orders.length);

    res.json(orders.map(o => ({
      id: o.orderId,
      userId: o.user,
      username: o.username,
      mobileNumber: o.mobileNumber,
      items: o.items.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      total: o.totalAmount,
      discount: o.discountApplied,
      deliveryCharge: o.deliveryCharge || 0,
      finalTotal: o.finalAmount,
      status: o.status,
      location: o.location,
      createdAt: o.createdAt
    })));
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE ORDER STATUS (Admin/Staff) - NO CSRF VALIDATION
app.put('/api/admin/orders/:id/status', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOneAndUpdate({ orderId: req.params.id }, { status }, { new: true });

    // --- SOCKET.IO EMIT ---
    if (order && order.user) {
      io.to(`user_${order.user}`).emit('orderStatusUpdated', {
        message: `Your order #${order.orderId} is now ${status}`,
        orderId: order.orderId,
        status: status,
        updatedBy: req.user.id
      });
    }

    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// COUPON ROUTES
// =====================

// GET ALL COUPONS
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find({ isActive: true });
    res.json(coupons.map(c => ({
      code: c.code,
      discountAmount: c.discountAmount,
      expiry: c.expiryDate.toISOString().split('T')[0],
      minOrderAmount: c.minOrderAmount,
      type: c.type,
      targetUsername: c.targetUsername || null,
      giftMessage: c.giftMessage || null
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VALIDATE COUPON
app.post('/api/coupons/validate', authenticateToken, async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    const userId = req.user.id;

    let username = req.user.username;
    if (!username) {
      const user = await User.findById(userId);
      username = user?.username;
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return res.json({ isValid: false, error: 'Invalid coupon code' });
    }

    if (new Date(coupon.expiryDate) < new Date()) {
      return res.json({ isValid: false, error: 'Coupon expired' });
    }

    if (username && coupon.usedBy.includes(userId)) {
      return res.json({ isValid: false, error: 'You have already redeemed this coupon.' });
    }

    console.log('🎟️ Coupon Validation Debug:');
    console.log('   Coupon targetUsername:', JSON.stringify(coupon.targetUsername));
    console.log('   User username:', JSON.stringify(username));

    if (coupon.targetUsername && username) {
      const couponTarget = coupon.targetUsername.trim().toLowerCase();
      const userTarget = username.trim().toLowerCase();
      console.log('   Comparing:', JSON.stringify(couponTarget), 'vs', JSON.stringify(userTarget));
      console.log('   Match:', couponTarget === userTarget);

      if (couponTarget !== userTarget) {
        return res.json({ isValid: false, error: 'This coupon is not available for your account.' });
      }
    } else if (coupon.targetUsername && !username) {
      console.log('   No username available for targeted coupon');
      return res.json({ isValid: false, error: 'This coupon is not available for your account.' });
    }

    const isSpecialGift = !!coupon.targetUsername || coupon.type === 'SPECIAL_GIFT';
    if (!isSpecialGift && coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
      return res.json({
        isValid: false,
        error: `Order must be at least Rs. ${coupon.minOrderAmount} to use this coupon.`
      });
    }
    console.log('   Is Special Gift:', isSpecialGift, '- Skipping min order check:', isSpecialGift);

    if (coupon.type === 'FIRST_ORDER') {
      const orderCount = await Order.countDocuments({ user: userId });
      if (orderCount > 0) {
        return res.json({ isValid: false, error: 'This coupon is valid for first order only.' });
      }
    }

    res.json({
      isValid: true,
      coupon: {
        code: coupon.code,
        discountAmount: coupon.discountAmount,
        expiry: coupon.expiryDate.toISOString().split('T')[0],
        minOrderAmount: coupon.minOrderAmount,
        type: coupon.type,
        targetUsername: coupon.targetUsername,
        giftMessage: coupon.giftMessage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE COUPON (Admin) - NO CSRF VALIDATION
app.post('/api/admin/coupons', authenticateToken, authorizeRoles('ADMIN'), validate({ body: couponSchema }), async (req, res) => {
  try {
    const { code, discountAmount, expiry, minOrderAmount, type, targetUsername, giftMessage } = req.body;

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discountAmount,
      minOrderAmount: minOrderAmount || 0,
      expiryDate: new Date(expiry),
      type: type || 'REGULAR',
      targetUsername: targetUsername || null,
      giftMessage: giftMessage || null
    });
    await coupon.save();

    res.json({
      message: 'Coupon created',
      coupon: {
        code: coupon.code,
        discountAmount: coupon.discountAmount,
        expiry: coupon.expiryDate.toISOString().split('T')[0],
        minOrderAmount: coupon.minOrderAmount,
        type: coupon.type,
        targetUsername: coupon.targetUsername,
        giftMessage: coupon.giftMessage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE COUPON (Admin) - NO CSRF VALIDATION
app.put('/api/admin/coupons/:code', authenticateToken, authorizeRoles('ADMIN'), validate({ body: couponSchema, params: codeSchema }), async (req, res) => {
  try {
    const { code, discountAmount, expiry, minOrderAmount } = req.body;
    const originalCode = req.params.code.toUpperCase();

    if (code.toUpperCase() !== originalCode) {
      const existing = await Coupon.findOne({ code: code.toUpperCase() });
      if (existing) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }
    }

    const coupon = await Coupon.findOneAndUpdate(
      { code: originalCode },
      {
        code: code.toUpperCase(),
        discountAmount,
        minOrderAmount: minOrderAmount || 0,
        expiryDate: new Date(expiry)
      },
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({
      message: 'Coupon updated',
      coupon: {
        code: coupon.code,
        discountAmount: coupon.discountAmount,
        expiry: coupon.expiryDate.toISOString().split('T')[0],
        minOrderAmount: coupon.minOrderAmount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE COUPON (Admin) - NO CSRF VALIDATION
app.delete('/api/admin/coupons/:code', authenticateToken, authorizeRoles('ADMIN'), validate({ params: codeSchema }), async (req, res) => {
  try {
    await Coupon.findOneAndDelete({ code: req.params.code.toUpperCase() });
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// STAFF MANAGEMENT ROUTES
// =====================

// GET ALL STAFF (Admin only)
app.get('/api/admin/staff', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const staffUsers = await User.find({ role: 'STAFF' }).select('-passwordHash');
    res.json(staffUsers.map(s => ({
      id: s._id,
      username: s.username,
      email: s.email,
      role: s.role,
      createdAt: s.createdAt
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE STAFF (Admin only) - NO CSRF VALIDATION
app.post('/api/admin/staff', authenticateToken, authorizeRoles('ADMIN'), validate({ body: staffSchema }), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const staff = new User({
      username,
      email,
      passwordHash,
      role: 'STAFF'
    });
    await staff.save();

    res.status(201).json({
      message: 'Staff created successfully',
      staff: {
        id: staff._id,
        username: staff.username,
        email: staff.email,
        role: staff.role,
        createdAt: staff.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE STAFF (Admin only) - NO CSRF VALIDATION
app.delete('/api/admin/staff/:id', authenticateToken, authorizeRoles('ADMIN'), validate({ params: idSchema }), async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    if (staff.role !== 'STAFF') {
      return res.status(400).json({ message: 'Cannot delete non-staff users' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Staff deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =====================
// GEO ROUTES
// =====================

app.get('/api/geo/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  res.json({ address: `Detected Location (${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)})` });
});

// --- ERROR HANDLERS ---
app.use(csrfErrorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
