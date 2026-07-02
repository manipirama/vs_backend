const express = require('express');
const nodemailer = require('nodemailer');
const { db } = require('../config/firebase');

const router = express.Router();
const contactsCollection = db.collection('contacts');

// Configure Nodemailer transporter (Requires EMAIL_USER and EMAIL_PASS in .env)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.get('/', async (req, res) => {
  try {
    const snapshot = await contactsCollection.get();
    const contacts = [];
    snapshot.forEach(doc => {
      contacts.push({ id: doc.id, ...doc.data() });
    });
    contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(contacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, updates, message } = req.body;

    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({ error: 'All fields except updates are required' });
    }

    await contactsCollection.add({
      firstName,
      lastName,
      email,
      updates: !!updates,
      message,
      createdAt: new Date().toISOString()
    });

    // Send email notification
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'manipirama27@gmail.com',
        subject: `New Contact Message from ${firstName} ${lastName}`,
        html: `
          <h2>New Contact Message Received!</h2>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Wants Updates:</strong> ${updates ? 'Yes' : 'No'}</p>
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
      message: 'Contact form submitted successfully!',
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(400).json({ error: error.message || 'Failed to submit contact form' });
  }
});

router.delete('/:id/', async (req, res) => {
  try {
    const docRef = contactsCollection.doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    await docRef.delete();
    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
