import axios from 'axios';

async function testPairingCode() {
  const sessionName = 'test-pairing-' + Date.now();
  const phoneNumber = '5511999999999'; // Replace with a valid number for real test if desired, but for mocked/dry-run checking flow is enough if we can't automate real WA interaction easily.
  // Actually, WPPConnect needs a real number to generate the code, otherwise it might fail or timeout?
  // If we just want to verify the API contract:

  try {
    console.log(`Creating session ${sessionName} with phone ${phoneNumber}...`);
    const response = await axios.post('http://localhost:3000/api/whatsapp/sessions', {
      sessionName,
      pairingMode: 'phone',
      phoneNumber,
    });

    console.log('Response:', response.data);

    if (response.data.status === 'PAIRING_CODE' && response.data.code) {
      console.log('✅ SUCCESS: Received Pairing Code:', response.data.code);
    } else {
      console.error('❌ FAILURE: Unexpected response format', response.data);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ HTTP Error:', error.response?.data || error.message);
    } else {
      console.error('❌ Error:', error);
    }
  }
}

testPairingCode();
