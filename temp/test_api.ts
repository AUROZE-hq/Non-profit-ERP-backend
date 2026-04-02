import axios from 'axios';

async function testApi() {
  try {
    const res = await axios.get('http://localhost:5000/api/slips/documents');
    console.log('API Response:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('API Error:', err.message);
    if (err.response) {
       console.error('Status:', err.response.status);
       console.error('Data:', err.response.data);
    }
  }
}

testApi();
