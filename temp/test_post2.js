const mongoose = require('mongoose');
const { SalarySlip } = require('./dist/models/SignatureSchema');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function testSign() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: true });
    // Find a slip without a signature
    const slip = await SalarySlip.findOne({ status: 'pending_signature' });
    if (!slip) {
      console.log('No pending slips found.');
      process.exit(0);
    }
    
    console.log(`Submitting signature for slip: ${slip._id}`);
    
    const res = await axios.post(`http://localhost:5000/api/slips/${slip._id}/sign`, {
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    });
    console.log('Success:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('API Error Response:', err.response.data);
    } else {
       console.error('API Error:', err.message);
    }
  } finally {
    mongoose.disconnect();
  }
}

testSign();
