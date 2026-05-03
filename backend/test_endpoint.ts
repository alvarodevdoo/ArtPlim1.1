import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('http://localhost:3000/api/finance/receivables/order/9706a04a-19f3-41c7-9760-34bbdfc10c81', {
      headers: {
        'Authorization': 'Bearer <TOKEN_WILL_BE_NEEDED_BUT_MAYBE_INTERNAL_BYPASS>'
      }
    });
    console.log('Response:', response.data);
  } catch (error: any) {
    console.log('Error Status:', error.response?.status);
    console.log('Error Data:', error.response?.data);
  }
}
// test();
console.log('I need a token to test this properly. But I can check the code for obvious bugs.');
