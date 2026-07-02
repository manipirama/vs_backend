const express = require('express');
const { db } = require('../config/firebase');

const router = express.Router();
const productsCollection = db.collection('products');
const inquiriesCollection = db.collection('inquiries');

// ─────────────────────────────────────────
//  GET /api/dashboard/stats/   → Dashboard statistics
// ─────────────────────────────────────────
router.get('/stats/', async (req, res) => {
  try {
    // Note: Firebase count() queries are more efficient than getting all docs
    const activeProductsSnapshot = await productsCollection.where('status', '==', 'Active').count().get();
    const inquiriesSnapshot = await inquiriesCollection.count().get();
    const allProductsSnapshot = await productsCollection.count().get();

    res.json({
      total_products: activeProductsSnapshot.data().count,
      total_inquiries: inquiriesSnapshot.data().count,
      total_all_products: allProductsSnapshot.data().count,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;
