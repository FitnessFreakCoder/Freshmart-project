
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
  const csrfToken = generateToken(req, res);
  res.json({ csrfToken });
});

// CSRF Error Handler
const csrfErrorHandler = (error, req, res, next) => {
  if (error === 'invalid csrf token') {
    return res.status(403).json({
      message: 'CSRF Validation Failed',
      code: 'CSRF_ERROR'
    });
  }
  next(error);
};

// app.use('/uploads', express.static('uploads')); // Removed duplicate

// --- MONGODB CONNECTION ---
console.log('🔄 Connecting to MongoDB Atlas...');
console.log('   URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'NOT SET');

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000, // 30 second timeout for initial connection
  socketTimeoutMS: 45000, // 45 second timeout for operations
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
      return res.sendStatus(401); // 401 triggers frontend auto-refresh
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

    // Generate short-lived access token (15 minutes)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate long-lived refresh token (7 days)
    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

    // Generate short-lived access token (15 minutes)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate long-lived refresh token (7 days)
    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

// 4. NEW GOOGLE LOGIN (Frontend @react-oauth/google)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1022561909186-33i8psb5samvvb42kmve5gs4i3vgulhu.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.post('/api/google-login', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      const passwordHash = await bcrypt.hash('GOOGLE_OAUTH_USER_' + Date.now(), 10);
      user = new User({
        username: name,
        email,
        passwordHash,
        role: 'USER', // Default role
        profilePicture: picture
      });
      await user.save();
    }

    // Generate short-lived access token (15 minutes)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate long-lived refresh token (7 days)
    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
    console.error('Google Login Error:', err);
    res.status(400).json({ message: 'Invalid Google Token' });
  }
});

// 3. GOOGLE AUTH
app.post('/api/auth/google', async (req, res) => {
  console.log('🔹 Google Auth Request:', req.body.email);
  try {
    const { email, name, picture } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user from Google profile
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
      // Update profile picture if changed
      if (picture && user.profilePicture !== picture) {
        user.profilePicture = picture;
        user.username = name; // Keep name in sync
        await user.save();
      }
    }

    // Generate short-lived access token (15 minutes)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate long-lived refresh token (7 days)
    const refreshToken = jwt.sign(
      { id: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

// 4. REFRESH TOKEN - Issue new access token from refresh cookie
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

// 5. LOGOUT - Clear refresh token cookie
app.post('/api/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

// 4. RESET PASSWORD
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

// 5. GET ALL PRODUCTS
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

// 6. ADD PRODUCT (Admin)
app.post('/api/admin/products', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), doubleCsrfProtection, upload.single('image'), validate({ body: productSchema }), async (req, res) => {
  console.log('🔹 Add Product Request');
  console.log('   Body:', req.body);
  try {
    const { name, price, originalPrice, unit, stock, category, imageUrl } = req.body;
    const bulkRule = req.body.bulkRule ? JSON.parse(req.body.bulkRule) : null;

    // Use uploaded file or provided URL
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

// 7. UPDATE PRODUCT (Admin)
app.put('/api/admin/products/:id', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), doubleCsrfProtection, upload.single('image'), validate({ body: productSchema, params: idSchema }), async (req, res) => {
  try {
    const { name, price, originalPrice, unit, stock, category, imageUrl } = req.body;
    const bulkRule = req.body.bulkRule ? JSON.parse(req.body.bulkRule) : null;

    const updateData = {
      name,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      unit,
      stock: Number(stock),
      category,
      bulkRule
    };

    // Only update image if new one uploaded or URL provided
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

// 8. DELETE PRODUCT (Admin)
app.delete('/api/admin/products/:id', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), doubleCsrfProtection, validate({ params: idSchema }), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// ORDER ROUTES
// =====================

// 9. PLACE ORDER
app.post('/api/orders', authenticateToken, doubleCsrfProtection, validate({ body: orderSchema }), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, discount, couponCodes, deliveryCharge, location, mobileNumber, username } = req.body;
    const orderId = `ORD-${Date.now()}`;

    // Recalculate Totals (Security)
    const calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const validDiscount = discount || 0;
    const validDelivery = deliveryCharge || 0;
    const calculatedFinal = calculatedTotal - validDiscount + validDelivery;

    // Mark coupons as used
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

    // Update Stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } }, { session });
    }

    // Update User Mobile if provided
    if (mobileNumber) {
      const rawMobile = mobileNumber.replace('+977-', '');
      await User.findByIdAndUpdate(req.user.id, { mobileNumber: rawMobile }, { session });
    }

    await session.commitTransaction();

    res.json({
      id: orderId,
      status: 'Pending',
      createdAt: order.createdAt
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// 10. GET ORDERS (User & Admin)
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
      // Convert string ID to ObjectId for proper MongoDB matching
      query = { user: new mongoose.Types.ObjectId(req.query.userId) };
    }
    // Default behavior: If not admin/staff, force filter by own ID
    else if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
      query = { user: new mongoose.Types.ObjectId(req.user.id) };
    }
    // If Admin/Staff and NO userId param, return ALL orders (default behavior for Admin Dashboard)

    console.log('   MongoDB query:', JSON.stringify(query));

    // First, let's see all orders in DB for debugging
    const allOrders = await Order.find({}).sort({ createdAt: -1 });
    console.log('   Total orders in DB:', allOrders.length);
    if (allOrders.length > 0) {
      console.log('   First 3 orders user IDs:');
      allOrders.slice(0, 3).forEach(o => {
        console.log(`     - Order ${o.orderId}: user=${o.user}, username=${o.username}`);
      });
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });
    console.log('   Filtered orders count:', orders.length);

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
    res.status(500).json({ error: err.message });
  }
});

// 11. UPDATE ORDER STATUS (Admin/Staff)
app.put('/api/admin/orders/:id/status', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), doubleCsrfProtection, async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findOneAndUpdate({ orderId: req.params.id }, { status });
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// COUPON ROUTES
// =====================

// 12. GET ALL COUPONS
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

// 13. VALIDATE COUPON
app.post('/api/coupons/validate', authenticateToken, async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    const userId = req.user.id;

    // Get username from JWT or fetch from database (for old tokens without username)
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

    // Check if already used by this user
    if (username && coupon.usedBy.includes(userId)) {
      return res.json({ isValid: false, error: 'You have already redeemed this coupon.' });
    }

    // Check if coupon is targeted to a specific user (Case Insensitive Check)
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

    // Skip minimum order check for special gift coupons (targeted to specific user)
    const isSpecialGift = !!coupon.targetUsername || coupon.type === 'SPECIAL_GIFT';
    if (!isSpecialGift && coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
      return res.json({
        isValid: false,
        error: `Order must be at least Rs. ${coupon.minOrderAmount} to use this coupon.`
      });
    }
    console.log('   Is Special Gift:', isSpecialGift, '- Skipping min order check:', isSpecialGift);

    // Check First Order logic
    if (coupon.type === 'FIRST_ORDER') {
      const orderCount = await Order.countDocuments({ userId });
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

// 14. CREATE COUPON (Admin)
app.post('/api/admin/coupons', authenticateToken, authorizeRoles('ADMIN'), doubleCsrfProtection, validate({ body: couponSchema }), async (req, res) => {
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

// 15. UPDATE COUPON (Admin)
app.put('/api/admin/coupons/:code', authenticateToken, authorizeRoles('ADMIN'), doubleCsrfProtection, validate({ body: couponSchema, params: codeSchema }), async (req, res) => {
  try {
    const { code, discountAmount, expiry, minOrderAmount } = req.body;
    const originalCode = req.params.code.toUpperCase();

    // Check if new code already exists (if changing code)
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

// 16. DELETE COUPON (Admin)
app.delete('/api/admin/coupons/:code', authenticateToken, authorizeRoles('ADMIN'), doubleCsrfProtection, validate({ params: codeSchema }), async (req, res) => {
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

// 17. GET ALL STAFF (Admin only)
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

// 18. CREATE STAFF (Admin only)
app.post('/api/admin/staff', authenticateToken, authorizeRoles('ADMIN'), doubleCsrfProtection, validate({ body: staffSchema }), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
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

// 19. DELETE STAFF (Admin only)
app.delete('/api/admin/staff/:id', authenticateToken, authorizeRoles('ADMIN'), doubleCsrfProtection, validate({ params: idSchema }), async (req, res) => {
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

// 17. REVERSE GEOCODE (placeholder)
app.get('/api/geo/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  // In production, use Google Maps Geocoding API or similar
  res.json({ address: `Detected Location (${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)})` });
});

// --- ERROR HANDLERS ---
app.use(csrfErrorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});