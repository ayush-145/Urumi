const axios = require('axios');
const API_URL = 'http://127.0.0.1:3000/api';
const STORE_NAME = 'store-1'; // Assuming store-1 exists

async function testOrder() {
    try {
        console.log(`Placing order for ${STORE_NAME}...`);
        const res = await axios.post(`${API_URL}/stores/${STORE_NAME}/orders`);
        console.log("✅ Order Response:", res.data);
    } catch (error) {
        console.error("❌ Order failed:", error.response ? error.response.data : error.message);
    }
}

testOrder();
