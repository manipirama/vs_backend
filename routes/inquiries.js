const express = require('express');
const nodemailer = require('nodemailer');
const { db } = require('../config/firebase');

const router = express.Router();
const inquiriesCollection = db.collection('inquiries');

// Configure Nodemailer transporter (Requires EMAIL_USER and EMAIL_PASS in .env)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function formatInquiry(docData, docId) {
  return {
    id: docId,
    product_name: docData.product_name,
    price: docData.price,
    name: docData.name,
    email: docData.email,
    mobile: docData.mobile,
    message: docData.message,
    created_at: docData.created_at,
  };
}

router.get('/', async (req, res) => {
  try {
    const snapshot = await inquiriesCollection.get();
    const inquiries = [];
    snapshot.forEach(doc => {
      inquiries.push(formatInquiry(doc.data(), doc.id));
    });
    inquiries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(inquiries);
  } catch (error) {
    console.error('Get inquiries error:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { product_name, price, name, email, mobile, message } = req.body;

    if (!name || !email || !mobile || !message) {
      return res.status(400).json({ error: 'Name, email, mobile, and message are required' });
    }

    const newInquiryData = {
      product_name: product_name || '',
      price: price || '',
      name,
      email,
      mobile,
      message,
      created_at: new Date().toISOString()
    };

    await inquiriesCollection.add(newInquiryData);

    // Send email notification
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'manipirama27@gmail.com',
        subject: `New Inquiry from ${name} for ${product_name || 'a product'}`,
        html: `
          <h2>New Inquiry Received!</h2>
          <p><strong>Customer Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Mobile:</strong> ${mobile}</p>
          <p><strong>Product Interested:</strong> ${product_name || 'N/A'}</p>
          <p><strong>Price:</strong> ${price || 'N/A'}</p>
          <p><strong>Message:</strong><br/>${message}</p>
        `,
      };
      
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email notification:', error);
        } else {
          console.log('Email notification sent:', info.response);
        }
      });
    } else {
      console.warn('⚠️ Email credentials not found in .env. Skipping email notification.');
    }

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully!',
    });
  } catch (error) {
    console.error('Create inquiry error:', error);
    res.status(400).json({ error: error.message || 'Failed to create inquiry' });
  }
});

router.delete('/:id/', async (req, res) => {
  try {
    const docRef = inquiriesCollection.doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    
    await docRef.delete();
    res.json({ success: true, message: 'Inquiry deleted' });
  } catch (error) {
    console.error('Delete inquiry error:', error);
    res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

module.exports = router;
