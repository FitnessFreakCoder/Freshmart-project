
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  token?: string;
  mobileNumber?: string; // Added to persist contact info
  profilePicture?: string; // Added for Google Login
}

export interface Product {
  id: number;
  name: string;
  price: number; // Selling Price
  originalPrice?: number; // MRP (for strikethrough)
  unit?: string; // e.g. '1 kg', '500 ml'
  stock: number;
  category: string;
  imageUrl: string;
  bulkRule?: {
    qty: number;
    price: number;
  };
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Coupon {
  code: string;
  discountAmount: number; // Flat discount for simplicity
  expiry: string;
  minOrderAmount?: number; // Minimum cart value required
  type?: 'REGULAR' | 'FIRST_ORDER';
  targetUsername?: string; // If set, coupon is only for this user
  giftMessage?: string; // Message like "Special gift from owner"
}

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

export enum OrderStatus {
  PENDING = 'Pending',
  READY = 'Ready',
  IN_TRANSIT = 'In Transit',
  DELIVERED = 'Delivered'
}

export interface Order {
  id: string;
  userId: number;
  username?: string; // Added for display purposes
  mobileNumber?: string; // Added for contact
  items: CartItem[];
  total: number; // Subtotal
  discount: number;
  deliveryCharge: number; // Added delivery fee
  finalTotal: number;
  status: OrderStatus;
  location: LocationData;
  couponCodes?: string[]; // Track applied coupons
  createdAt: string;
}

export interface AppState {
  user: User | null;
  products: Product[];
  cart: CartItem[];
  orders: Order[];
  coupons: Coupon[];
  currentOrder: Order | null;
}
