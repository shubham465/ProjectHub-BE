require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const { seedDevUsers } = require('./src/seeder');

const runSeed = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected! Running seeder...');
    
    const adminEmail = 'admin@projecthub.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('User admin@projecthub.com already exists.');
    } else {
      await User.create({
        name: 'Super Admin',
        email: adminEmail,
        password: 'admin',
        role: 'Admin',
      });
      console.log('User admin@projecthub.com successfully created with password admin!');
    }
    console.log('Seeding complete. Closing connection.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
};

runSeed();
