const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../config/firebase');
const cloudinary = require('../config/cloudinary');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const productsCollection = db.collection('products');

// ──── Upload dirs ────
const imgDir = path.join(__dirname, '..', 'uploads', 'products');
const docDir = path.join(__dirname, '..', 'uploads', 'documents');
[imgDir, docDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ──── Multer: accept image + document in one request ────
const uploadBoth = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, file.fieldname === 'document' ? docDir : imgDir);
    },
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB overall
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'image') {
      const ok = ['image/jpeg', 'image/png', 'image/webp'];
      if (ok.includes(file.mimetype)) return cb(null, true);
      return cb(new Error('Only JPG, PNG, WEBP images allowed'));
    }
    if (file.fieldname === 'document') {
      const ok = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (ok.includes(file.mimetype)) return cb(null, true);
      return cb(new Error('Only PDF, DOC, DOCX, XLS, XLSX documents allowed'));
    }
    cb(null, false);
  },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 },
]);

// ──── Helpers ────
function buildUrl(filePath, req) {
  if (!filePath) return null;
  if (filePath.startsWith('http') || filePath.startsWith('data:image')) return filePath;
  // Always return full URL (works for both local dev and production)
  return `${req.protocol}://${req.get('host')}/${filePath}`;
}

function formatProduct(pData, pId, req) {
  const placeholder = 'https://via.placeholder.com/300x200?text=No+Image';
  const imageUrl = pData.image ? pData.image : placeholder; // Cloudinary URL or placeholder
  return {
    id: pId,
    name: pData.name,
    price: pData.price,
    image: pData.image,
    image_url: imageUrl,
    document: pData.document,
    document_url: buildUrl(pData.document, req),
    document_name: pData.document_name || null,
    description: pData.description,
    status: pData.status,
    created_at: pData.created_at || new Date().toISOString(),
  };
}

// ─────────────────────────────────────────
//  GET  /api/products/       → Active products (public)
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const snapshot = await productsCollection.where('status', '==', 'Active').get();
    const products = [];
    snapshot.forEach(doc => {
      products.push(formatProduct(doc.data(), doc.id, req));
    });
    // Sort in memory by created_at descending (Firebase requires composite indexes for sort + filter if we do it in DB)
    products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ─────────────────────────────────────────
//  POST /api/products/       → Create (admin)
// ─────────────────────────────────────────
router.post('/', optionalAuth, uploadBoth, async (req, res) => {
  try {
    const isAdmin = req.admin || req.isAdminRole || req.headers['x-user-role'] === 'Admin';
    if (!isAdmin) return res.status(403).json({ error: 'Only Admins can create products' });

    const { name, price, description, status } = req.body;
    const files = req.files || {};

    let imagePath = null;
    if (files.image) {
      const file = files.image[0];
      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'pos_products',
        resource_type: 'image',
      });
      imagePath = uploadResult.secure_url; // Store URL
      // Remove temp file
      fs.unlinkSync(file.path);
    }
    
    const docPath   = files.document ? `uploads/documents/${files.document[0].filename}` : null;
    const docName   = files.document ? files.document[0].originalname : null;

    const newProductData = {
      name,
      price: Number(price) || 0,
      description: description || null,
      status: status || 'Active',
      image: imagePath,
      document: docPath,
      document_name: docName,
      created_at: new Date().toISOString()
    };

    const docRef = await productsCollection.add(newProductData);

    res.status(201).json(formatProduct(newProductData, docRef.id, req));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create product' });
  }
});

// ─────────────────────────────────────────
//  GET /api/products/all/    → All products (admin)
// ─────────────────────────────────────────
router.get('/all/', async (req, res) => {
  try {
    const snapshot = await productsCollection.get();
    const products = [];
    snapshot.forEach(doc => {
      products.push(formatProduct(doc.data(), doc.id, req));
    });
    // Sort in memory by created_at descending
    products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ─────────────────────────────────────────
//  GET /api/products/:id/
// ─────────────────────────────────────────
router.get('/:id/', async (req, res) => {
  try {
    const doc = await productsCollection.doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });
    res.json(formatProduct(doc.data(), doc.id, req));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ─────────────────────────────────────────
//  PUT /api/products/:id/    → Update (admin)
// ─────────────────────────────────────────
router.put('/:id/', optionalAuth, uploadBoth, async (req, res) => {
  try {
    const isAdmin = req.admin || req.isAdminRole || req.headers['x-user-role'] === 'Admin';
    if (!isAdmin) return res.status(403).json({ error: 'Only Admins can edit products' });

    const docRef = productsCollection.doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });

    const productData = doc.data();
    const { name, price, description, status } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = Number(price);
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;

    const files = req.files || {};
    if (files.image) {
      const file = files.image[0];
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        folder: 'pos_products',
        resource_type: 'image',
      });
      updateData.image = uploadResult.secure_url;
      fs.unlinkSync(file.path);
    }
    if (files.document) {
      updateData.document = `uploads/documents/${files.document[0].filename}`;
      updateData.document_name = files.document[0].originalname;
    }

    if (Object.keys(updateData).length > 0) {
      await docRef.update(updateData);
    }
    
    // Merge for response
    const updatedData = { ...productData, ...updateData };
    res.json(formatProduct(updatedData, req.params.id, req));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update product' });
  }
});

// ─────────────────────────────────────────
//  DELETE /api/products/:id/
// ─────────────────────────────────────────
router.delete('/:id/', optionalAuth, async (req, res) => {
  try {
    const isAdmin = req.admin || req.isAdminRole || req.headers['x-user-role'] === 'Admin';
    if (!isAdmin) return res.status(403).json({ error: 'Only Admins can delete products' });

    const docRef = productsCollection.doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });

    await docRef.delete();
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
