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

const customUsers = [
  {
    name: 'Sarah Falcons O',
    email: 'sarah.falcons.o@gmail.com',
    password: 'person1234',
    role: 'staff'
  },
  {
    name: 'Kyla Wilson',
    email: 'kyla.wilson@gmail.com',
    password: 'person1234',
    role: 'staff'
  },
  {
    name: 'Jey Shan',
    email: 'kithun.ielts@gmail.com',
    password: 'person1234',
    role: 'staff'
  },
  {
    name: 'Nesha Wilson',
    email: 'neshafam@gmail.com',
    password: 'person1234',
    role: 'manager'
  }
];

async function seedCustomUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for custom seeding');

    for (const u of customUsers) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`User ${u.name} (${u.email}) already exists. Skipping.`);
        continue;
      }
      
      const user = new User(u);
      await user.save();
      console.log(`User created: ${u.name} (Role: ${u.role})`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding custom users:', error);
    process.exit(1);
  }
}

seedCustomUsers();
