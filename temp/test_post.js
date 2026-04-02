const axios = require('axios');

async function testSign() {
  try {
    const res = await axios.post('http://localhost:5000/api/slips/0fe7467e-58bb-47a9-8ea8-39ef7d10fb00/sign', {
      signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    });
    console.log('Success:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('API Error Response:', err.response.data);
    } else {
       console.error('API Error:', err.message);
    }
  }
}

testSign();
