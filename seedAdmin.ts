import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from './models/User';

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGODB_URI || '';

if (!MONGO_URI) {
  console.error('MONGODB_URI is not defined in .env');
  process.exit(1);
}

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding');

    const adminEmail = 'admin@erp.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin user already exists.');
    } else {
      const admin = new User({
        name: 'Super Admin',
        email: adminEmail,
        password: 'adminpassword123', // This will be hashed by the pre-save hook
        role: 'admin',
      });

      await admin.save();
      console.log('Admin user created successfully!');
      console.log('Email: admin@erp.com');
      console.log('Password: adminpassword123');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  }
}

seedAdmin();
