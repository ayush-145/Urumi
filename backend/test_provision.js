const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const STORE_NAME = 'test-store';

async function testProvisioning() {
    try {
        console.log(`Creating store '${STORE_NAME}'...`);
        const createRes = await axios.post(`${API_URL}/stores`, { name: STORE_NAME });
        console.log("✅ Create Response:", createRes.data);

        console.log("Polling for status...");
        let attempts = 0;
        const interval = setInterval(async () => {
            try {
                const listRes = await axios.get(`${API_URL}/stores`);
                const store = listRes.data.find(s => s.name === STORE_NAME);

                if (store) {
                    console.log(`Current Status: ${store.status}`);
                    if (store.status === 'Ready') {
                        console.log("✅ Store is Ready!");
                        clearInterval(interval);
                    }
                } else {
                    console.log("Store not found in list yet...");
                }

                attempts++;
                if (attempts > 30) { // Timeout after 60s (2s interval)
                    console.log("❌ Timeout waiting for store to be ready.");
                    clearInterval(interval);
                }
            } catch (e) {
                console.error("Polling error:", e.message);
            }
        }, 2000);

    } catch (error) {
        console.error("❌ verification failed:", error.response ? error.response.data : error.message);
    }
}

testProvisioning();
