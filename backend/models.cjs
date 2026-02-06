
// models.js
const mongoose = require('mongoose');

// 1. USER SCHEMA
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['USER', 'ADMIN', 'STAFF'], default: 'USER' },
  mobileNumber: { type: String }, // e.g., 98XXXXXXXX
  profilePicture: { type: String } // For Google OAuth profile picture
}, { timestamps: true });

// 2. PRODUCT SCHEMA
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true }, // Selling Price
  originalPrice: { type: Number }, // MRP
  unit: { type: String }, // e.g. '1 kg'
  stock: { type: Number, default: 0 },
  category: { type: String },
  imageUrl: { type: String },
  // Embedded Bulk Rule
  bulkRule: {
    qty: { type: Number },
    price: { type: Number }
  }
}, { timestamps: true });

// 3. COUPON SCHEMA
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  discountAmount: { type: Number, required: true },
  minOrderAmount: { type: Number, default: 0 },
  expiryDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  type: { type: String, enum: ['REGULAR', 'FIRST_ORDER', 'SPECIAL_GIFT'], default: 'REGULAR' },
  targetUsername: { type: String, default: null }, // If set, coupon is only for this user
  giftMessage: { type: String, default: null }, // Special message for gift coupons
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Track users who have redeemed this coupon
});

// 4. ORDER SCHEMA
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // Human readable ID like ORD-123
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String }, // Snapshot of username
  mobileNumber: { type: String },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String },
    price: { type: Number }, // Snapshot price at time of order
    quantity: { type: Number }
  }],
  totalAmount: { type: Number, required: true },
  discountApplied: { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Ready', 'In Transit', 'Delivered'],
    default: 'Pending'
  },
  location: {
    lat: Number,
    lng: Number,
    address: String
  }
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', userSchema),
  Product: mongoose.model('Product', productSchema),
  Coupon: mongoose.model('Coupon', couponSchema),
  Order: mongoose.model('Order', orderSchema)
};
