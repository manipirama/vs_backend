const { db } = require('./config/firebase');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    const email = '[EMAIL_ADDRESS]';
    const password = '[PASSWORD]';
    const name = 'Main Admin';

    const adminCollection = db.collection('admins');
    const existing = await adminCollection.where('email', '==', email).get();

    if (!existing.empty) {
      console.log('Admin already exists!');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(password, salt);

    await adminCollection.add({
      name: name,
      email: email,
      password: hashedPassword,
      is_active: true,
      createdAt: new Date().toISOString()
    });

    console.log('✅ Default Admin created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
