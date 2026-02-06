const { z } = require('zod');
const mongoose = require('mongoose');

// Helper to validate MongoDB ObjectId
const objectId = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
});

// Middleware factory
const validate = (schemaObj) => (req, res, next) => {
    try {
        if (schemaObj.body) {
            req.body = schemaObj.body.parse(req.body);
        }
        if (schemaObj.query) {
            req.query = schemaObj.query.parse(req.query);
        }
        if (schemaObj.params) {
            req.params = schemaObj.params.parse(req.params);
        }
        next();
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                message: 'Validation Error',
                errors: err.errors.map(e => ({
                    path: e.path.join('.'),
                    message: e.message
                }))
            });
        }
        next(err);
    }
};

// --- SCHEMAS ---

// 1. PRODUCT SCHEMA
const productSchema = z.object({
    name: z.string().min(1),
    price: z.string().or(z.number()).transform(v => Number(v)),
    originalPrice: z.string().or(z.number()).optional().transform(v => v ? Number(v) : undefined),
    unit: z.string().optional(),
    stock: z.string().or(z.number()).transform(v => Number(v)),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    bulkRule: z.string().optional().transform(v => v ? JSON.parse(v) : undefined).or(
        z.object({
            qty: z.number(),
            price: z.number()
        }).optional().nullable()
    )
}); // Note: strict() removed here because multer adds fields, wait, multer runs before validation? 
// Actually, for multipart/form-data, req.body might come after multer processing.
// However, req.body usually contains other fields.
// Since we are validating *after* multer (to get the file), we should be careful.
// Multer puts fields in req.body.
// We can use strict() but we need to ensure all fields are defined.

// 2. ORDER SCHEMA
const orderSchema = z.object({
    items: z.array(z.object({
        id: z.string(), // Product ID
        name: z.string(),
        price: z.number(),
        quantity: z.number().int().min(1)
    })),
    discount: z.number().optional(),
    couponCodes: z.array(z.string()).optional(),
    deliveryCharge: z.number().optional(),
    location: z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string().optional()
    }),
    mobileNumber: z.string().optional(),
    username: z.string().optional()
});

// 3. COUPON SCHEMA
const couponSchema = z.object({
    code: z.string().min(3).toUpperCase(),
    discountAmount: z.number().min(1),
    expiry: z.string().datetime().or(z.string()), // Accept ISO string
    minOrderAmount: z.number().optional(),
    type: z.enum(['REGULAR', 'FIRST_ORDER', 'SPECIAL_GIFT']).optional(),
    targetUsername: z.string().optional().nullable(),
    giftMessage: z.string().optional().nullable()
});

// 4. STAFF SCHEMA
const staffSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6)
});

// 5. PARAMS ID SCHEMA
const idSchema = z.object({
    id: objectId
}).strict();

// 6. PARAMS CODE SCHEMA
const codeSchema = z.object({
    code: z.string()
}).strict();

module.exports = {
    validate,
    productSchema,
    orderSchema,
    couponSchema,
    staffSchema,
    idSchema,
    codeSchema
};
