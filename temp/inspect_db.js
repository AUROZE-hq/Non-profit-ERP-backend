const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
// Mongoose Model
const slipSchema = new mongoose.Schema({}, { strict: false });
const SalarySlip = mongoose.model('SalarySlip', slipSchema, 'salaryslips');

async function testSign() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: true });
    const slips = await SalarySlip.find().sort({ createdAt: -1 }).limit(5);
    slips.forEach(s => {
      console.log(`ID: ${s._id}, Status: ${s.status}, pdfUrl: ${s.pdfUrl || 'NONE'}`);
    });
  } catch (err) {
      console.error('API Error Response:', err);
  } finally {
    mongoose.disconnect();
  }
}
testSign();
