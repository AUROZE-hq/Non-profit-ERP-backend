import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const SalarySlip = mongoose.model('SalarySlip', new mongoose.Schema({}, { strict: false }));
    
    console.log('--- All Slips ---');
    const allSlips = await SalarySlip.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log(JSON.stringify(allSlips, null, 2));

    console.log('--- Count by Status ---');
    const counts = await SalarySlip.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log(counts);

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkDatabase();
