const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');

const router = express.Router();
const adminCollection = db.collection('admins');

// ─────────────────────────────────────────
//  POST /api/auth/login/
//  Admin Login
// ─────────────────────────────────────────
router.post('/login/', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const emailToFind = email.trim().toLowerCase();
    const querySnapshot = await adminCollection.where('email', '==', emailToFind).where('is_active', '==', true).limit(1).get();

    if (querySnapshot.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const adminDoc = querySnapshot.docs[0];
    const adminData = adminDoc.data();
    const adminId = adminDoc.id;

    // Check password
    const isMatch = await bcrypt.compare(password, adminData.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: adminId, email: adminData.email, name: adminData.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Response matches Django format for frontend compatibility
    res.json({
      success: true,
      admin_id: adminId,
      name: adminData.name,
      email: adminData.email,
      role: 'Admin',
      token,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────
//  POST /api/auth/signup/
//  Admin Signup (NEW)
// ─────────────────────────────────────────
router.post('/signup/', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const emailToFind = email.trim().toLowerCase();
    
    // Check if admin already exists
    const querySnapshot = await adminCollection.where('email', '==', emailToFind).limit(1).get();
    
    if (!querySnapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'An admin with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new admin
    const newAdminData = {
      name: name.trim(),
      email: emailToFind,
      password: hashedPassword,
      is_active: true,
      createdAt: new Date().toISOString()
    };

    const docRef = await adminCollection.add(newAdminData);
    const adminId = docRef.id;

    // Generate JWT token
    const token = jwt.sign(
      { id: adminId, email: newAdminData.email, name: newAdminData.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      admin_id: adminId,
      name: newAdminData.name,
      email: newAdminData.email,
      role: 'Admin',
      token,
      message: 'Signup successful',
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
