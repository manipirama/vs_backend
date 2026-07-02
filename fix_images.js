/**
 * Quick fix script: Update product image paths in DB to match actual files on disk.
 * Run once: node fix_images.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const Product = require('./models/Product');

async function fixImages() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Get actual files in uploads/products
  const imgDir = path.join(__dirname, 'uploads', 'products');
  const actualFiles = fs.readdirSync(imgDir);
  console.log('Actual files on disk:', actualFiles);

  // Get all products
  const products = await Product.find();
  console.log(`Found ${products.length} products in DB`);

  for (const p of products) {
    const currentImage = p.image;
    if (!currentImage) {
      console.log(`  "${p.name}" - no image set, skipping`);
      continue;
    }

    const currentFilename = path.basename(currentImage);
    const fileExists = actualFiles.includes(currentFilename);

    if (fileExists) {
      console.log(`  "${p.name}" - image OK: ${currentFilename}`);
    } else {
      console.log(`  "${p.name}" - BROKEN: ${currentFilename} not found on disk`);
      // Assign first available image file
      if (actualFiles.length > 0) {
        const newFile = actualFiles.shift(); // take first available
        p.image = `uploads/products/${newFile}`;
        await p.save();
        console.log(`    -> FIXED: assigned ${newFile}`);
      } else {
        console.log(`    -> No files available to assign`);
      }
    }
  }

  // Check for any products without images that could use remaining files
  const noImageProducts = await Product.find({ image: null });
  for (const p of noImageProducts) {
    if (actualFiles.length > 0) {
      const newFile = actualFiles.shift();
      p.image = `uploads/products/${newFile}`;
      await p.save();
      console.log(`  "${p.name}" - assigned image: ${newFile}`);
    }
  }

  console.log('\nDone! Restart your dev server.');
  process.exit(0);
}

fixImages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
