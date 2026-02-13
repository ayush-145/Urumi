const axios = require('axios');

const API_URL = 'http://127.0.0.1:3000/api';

async function testBackend() {
    try {
        console.log("Testing Login...");
        const loginRes = await axios.post(`${API_URL}/login`, {
            username: 'admin',
            password: 'password'
        });

        if (loginRes.data.token) {
            console.log("✅ Login Successful. Token:", loginRes.data.token);
        } else {
            console.error("❌ Login Failed: No token returned");
        }

        console.log("\nTesting Store List...");
        const storesRes = await axios.get(`${API_URL}/stores`);
        console.log("✅ Store List Fetched:", storesRes.data);

    } catch (error) {
        console.error("❌ verification failed:", error.response ? error.response.data : error.message);
    }
}

testBackend();
