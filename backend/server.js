const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const k8s = require('@kubernetes/client-node');
const path = require('path');

const app = express();
const PORT = 3000;

// CONFIGURATION
// Assuming your 'my-store' helm chart is in the parent directory
const CHART_PATH = path.join(__dirname, '../store-chart');

// MIDDLEWARE
app.use(cors()); // Allow React to hit this API
app.use(express.json()); // Parse JSON bodies
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// LOGIN ENDPOINT
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Hardcoded credentials for simplicity as per requirements
    if (username === 'admin' && password === 'password') {
        return res.json({ token: 'mock-token-123', user: { username: 'admin' } });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
});

// KUBERNETES CLIENT SETUP
const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // Loads config from ~/.kube/config (works with Kind automatically)
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// HELPER: Execute Shell Commands (Promisified with Realtime Logs)
const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, { shell: true });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            process.stdout.write(data);
            stdout += data;
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
            stderr += data;
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
};

const fs = require('fs'); // Ensure this is at the top!

// 1. CREATE STORE (POST /api/stores)
app.post('/api/stores', async (req, res) => {
    const { name } = req.body;

    if (!name || !/^[a-z0-9-]+$/.test(name)) {
        return res.status(400).json({ error: "Invalid name." });
    }

    const namespace = name;

    // FIX: Structure for Bitnami WordPress Subchart
    // We must nest configuration under 'wordpress'
    const valuesContent = `
store:
  ingress:
    enabled: true
    hostname: ${name}.localhost
    path: /
    pathType: ImplementationSpecific
    annotations:
      kubernetes.io/ingress.class: nginx
`;

    // Create the temp file
    const valuesFilePath = path.join(__dirname, `${name}-values.yaml`);

    try {
        fs.writeFileSync(valuesFilePath, valuesContent);

        // Debug: Log the file path to ensure it exists
        console.log(`Created config at: ${valuesFilePath}`);

        // Run Helm
        const cmd = `helm install ${name} ${CHART_PATH} --namespace ${namespace} --create-namespace -f "${valuesFilePath}"`;
        console.log(`Executing: ${cmd}`);

        await runCommand(cmd);

        // Cleanup
        fs.unlinkSync(valuesFilePath);

        // START WOOCOMMERCE SETUP IN BACKGROUND
        (async () => {
            try {
                console.log(`[${name}] Waiting for pod to be running...`);
                // Simple poll for pod name
                let podName = '';
                for (let i = 0; i < 120; i++) { // 10 minutes (120 * 5s)
                    try {
                        const output = await runCommand(`kubectl get pods -n ${namespace} -o json`);
                        const podsData = JSON.parse(output);
                        const pod = podsData.items.find(p => {
                            const labels = p.metadata.labels || {};
                            return (labels['app.kubernetes.io/name'] === 'wordpress' || labels['app.kubernetes.io/name'] === 'store')
                                && p.status.phase === 'Running';
                        });

                        if (pod) {
                            podName = pod.metadata.name;
                            break;
                        }
                    } catch (e) {
                        // kubectl or parse failed, retry
                    }
                    console.log(`[${name}] Waiting for pod... (Attempt ${i + 1}/120)`);
                    await new Promise(r => setTimeout(r, 5000));
                }

                if (podName) {
                    console.log(`[${name}] Found pod: ${podName}. Copying setup script...`);
                    // Copy script to pod
                    await runCommand(`kubectl cp ./setup-woo.sh ${namespace}/${podName}:/tmp/setup-woo.sh`);

                    console.log(`[${name}] Executing setup script...`);
                    // Exec script
                    await runCommand(`kubectl exec -n ${namespace} ${podName} -- /bin/bash /tmp/setup-woo.sh`);
                    console.log(`[${name}] WooCommerce setup complete!`);

                    // LABEL POD AS READY
                    console.log(`[${name}] Labeling pod as ready...`);
                    await runCommand(`kubectl label pod ${podName} -n ${namespace} urumi.io/store-status=ready --overwrite`);
                } else {
                    console.error(`[${name}] Timed out waiting for pod.`);
                }
            } catch (err) {
                console.error(`[${name}] Setup failed:`, err);
            }
        })();

        res.json({
            status: "installing",
            message: `Store '${name}' provisioned. WooCommerce setup started in background.`,
            url: `http://${name}.localhost`
        });
    } catch (err) {
        console.error("Provisioning failed:", err);
        if (fs.existsSync(valuesFilePath)) fs.unlinkSync(valuesFilePath);
        res.status(500).json({ error: "Provisioning failed", details: err });
    }
});

// 2. LIST STORES (GET /api/stores)
app.get('/api/stores', async (req, res) => {
    try {
        // 1. Get all Namespaces via kubectl
        const nsOutput = await runCommand('kubectl get namespaces -o json');
        const nsItems = JSON.parse(nsOutput).items;

        // 2. Get ALL Pods in the cluster via kubectl
        const podsOutput = await runCommand('kubectl get pods -A -o json');
        const allPods = JSON.parse(podsOutput).items;

        // 3. Filter for our stores
        const ignoredNamespaces = ['default', 'kube-system', 'kube-public', 'kube-node-lease', 'local-path-storage', 'ingress-nginx'];

        const storeStatuses = nsItems
            .filter(ns => !ignoredNamespaces.includes(ns.metadata.name))
            .map(nsObj => {
                const nsName = nsObj.metadata.name;

                // Find pods that belong to this store
                const nsPods = allPods.filter(pod => pod.metadata.namespace === nsName);

                // Determine Status
                let status = 'Provisioning'; // Default to Provisioning
                if (nsPods.length === 0) status = 'Empty';

                const readyPod = nsPods.find(pod => {
                    const phase = pod.status.phase;
                    const labels = pod.metadata.labels || {};
                    return phase === 'Running' && labels['urumi.io/store-status'] === 'ready';
                });

                if (readyPod) status = 'Ready';

                return {
                    name: nsName,
                    status: status,
                    url: `http://${nsName}.localhost`,
                    createdAt: nsObj.metadata.creationTimestamp
                };
            });

        res.json(storeStatuses);

    } catch (err) {
        console.error("Fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch stores", details: err.message });
    }
});

// 3. DELETE STORE (DELETE /api/stores/:name)
app.delete('/api/stores/:name', async (req, res) => {
    const { name } = req.params;

    // Command: Helm Uninstall first, then delete Namespace
    // We chain them with && (on Windows/Linux usually works, or run sequentially)

    console.log(`Deleting store: ${name}`);

    try {
        // 1. Uninstall Helm Chart
        try {
            await runCommand(`helm uninstall ${name} --namespace ${name}`);
        } catch (e) {
            console.log("Helm uninstall warning (might already be gone):", e);
        }

        // 2. Delete Namespace (This cleans up PVCs and other remnants)
        await runCommand(`kubectl delete namespace ${name}`);

        res.json({ status: "deleted", name });
    } catch (err) {
        console.error("Delete failed:", err);
        res.status(500).json({ error: "Failed to delete store", details: err });
    }
});



// START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Orchestrator running on http://0.0.0.0:${PORT}`);
    console.log(`Helm Chart Path: ${CHART_PATH}`);
});