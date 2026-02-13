const axios = require('axios');

const API_URL = 'http://localhost:3000/api/stores';

async function runTests() {
    try {
        console.log("--- 1. Listing initial stores ---");
        let res = await axios.get(API_URL);
        console.log("Current stores:", res.data);

        // Cleanup existing failed stores
        for (const store of res.data) {
            if (store.name === 'alpha-shop' || store.name === 'beta-shop') {
                console.log(`--- Cleaning up ${store.name} ---`);
                await axios.delete(`${API_URL}/${store.name}`);
                console.log(`Deleted ${store.name}`);
            }
        }

        // Wait a bit for cleanup
        await new Promise(r => setTimeout(r, 2000));

        console.log("--- 2. Creating 3 stores ---");
        const stores = ['store-1', 'store-2', 'store-3'];
        for (const name of stores) {
            console.log(`Creating ${name}...`);
            try {
                const createRes = await axios.post(API_URL, { name });
                console.log(`Created ${name}:`, createRes.data);
            } catch (e) {
                console.error(`Failed to create ${name}:`, e.response?.data || e.message);
            }
        }

        console.log("--- 3. Listing stores after creation ---");
        res = await axios.get(API_URL);
        console.log("Stores list:", res.data);

        console.log("--- 4. Deleting all stores ---");
        for (const name of stores) {
            console.log(`Deleting ${name}...`);
            try {
                await axios.delete(`${API_URL}/${name}`);
                console.log(`Deleted ${name}`);
            } catch (e) {
                console.error(`Failed to delete ${name}:`, e.message);
            }
        }

        console.log("--- 5. Final verification ---");
        // Wait a bit
        await new Promise(r => setTimeout(r, 2000));
        res = await axios.get(API_URL);
        console.log("Final Stores list:", res.data);

    } catch (err) {
        console.error("Test failed:", err.message);
        if (err.response) {
            console.error("Response data:", err.response.data);
        }
    }
}

runTests();
