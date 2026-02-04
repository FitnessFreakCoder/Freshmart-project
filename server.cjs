
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
const path = require('path');
require('dotenv').config();

const { User, Product, Coupon, Order } = require('./models.cjs');

const app = express();
app.use(express.json());

// CORS Configuration - allow frontend dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/uploads', express.static('uploads'));

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
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return res.status(403).send("Admin Access Required");
  next();
};

const isStaffOrAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
    return res.status(403).send("Staff or Admin Access Required");
  }
  next();
};

// --- IMAGE UPLOAD ---
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

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

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      token,
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

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
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

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
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
app.post('/api/admin/products', authenticateToken, isStaffOrAdmin, upload.single('image'), async (req, res) => {
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
app.put('/api/admin/products/:id', authenticateToken, isStaffOrAdmin, upload.single('image'), async (req, res) => {
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
app.delete('/api/admin/products/:id', authenticateToken, isStaffOrAdmin, async (req, res) => {
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
app.post('/api/orders', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, total, discount, deliveryCharge, finalTotal, location, mobileNumber, username } = req.body;

    const orderId = 'ORD-' + Date.now();
    const order = new Order({
      orderId,
      user: req.user.id,
      username,
      mobileNumber,
      items: items.map(i => ({
        productId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity
      })),
      totalAmount: total,
      discountApplied: discount || 0,
      deliveryCharge: deliveryCharge || 0,
      finalAmount: finalTotal,
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
    if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
      query = { user: req.user.id };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

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
app.put('/api/admin/orders/:id/status', authenticateToken, isStaffOrAdmin, async (req, res) => {
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
      minOrderAmount: c.minOrderAmount
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. VALIDATE COUPON
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return res.json({ isValid: false, error: 'Invalid coupon code' });
    }

    if (new Date(coupon.expiryDate) < new Date()) {
      return res.json({ isValid: false, error: 'Coupon expired' });
    }

    if (coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
      return res.json({
        isValid: false,
        error: `Order must be at least Rs. ${coupon.minOrderAmount} to use this coupon.`
      });
    }

    res.json({
      isValid: true,
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

// 14. CREATE COUPON (Admin)
app.post('/api/admin/coupons', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { code, discountAmount, expiry, minOrderAmount } = req.body;

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discountAmount,
      minOrderAmount: minOrderAmount || 0,
      expiryDate: new Date(expiry)
    });
    await coupon.save();

    res.json({
      message: 'Coupon created',
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

// 15. UPDATE COUPON (Admin)
app.put('/api/admin/coupons/:code', authenticateToken, isAdmin, async (req, res) => {
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
app.delete('/api/admin/coupons/:code', authenticateToken, isAdmin, async (req, res) => {
  try {
    await Coupon.findOneAndDelete({ code: req.params.code.toUpperCase() });
    res.json({ message: 'Coupon deleted' });
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

// =====================
// START SERVER
// =====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));