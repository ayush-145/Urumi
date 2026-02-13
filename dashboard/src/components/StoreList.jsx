import React, { useEffect, useState } from 'react';
import api from '../api';
import StatusBadge from './StatusBadge';

const StoreList = ({ refreshTrigger }) => {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchStores = async () => {
        try {
            const res = await api.get('/stores');
            setStores(res.data);
        } catch (error) {
            console.error("Failed to fetch stores", error);
        } finally {
            setLoading(false);
        }
    };

    // Poll for updates every 5 seconds
    useEffect(() => {
        fetchStores();
        const interval = setInterval(fetchStores, 5000);
        return () => clearInterval(interval);
    }, [refreshTrigger]);

    const handleDelete = async (name) => {
        if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;

        // Optimistic update
        setStores(stores.filter(s => s.name !== name));

        try {
            await api.delete(`/stores/${name}`);
        } catch (error) {
            console.error("Failed to delete", error);
            fetchStores(); // Revert on error
        }
    };



    if (loading && stores.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (stores.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800 mb-4">
                    <span className="text-2xl">🛍️</span>
                </div>
                <h3 className="text-lg font-medium text-white">No stores yet</h3>
                <p className="text-zinc-500 mt-1">Ready to launch your first store?</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
                <div key={store.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-zinc-800 rounded-lg">
                            <span className="text-xl">🏪</span>
                        </div>
                        <StatusBadge status={store.status} />
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-1">{store.name}</h3>
                    <p className="text-xs text-zinc-500 mb-6">
                        Created {new Date(store.createdAt).toLocaleDateString()}
                    </p>

                    <div className="flex gap-3">
                        <a
                            href={store.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${store.status === 'Ready'
                                ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                                : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                                }`}
                            onClick={(e) => store.status !== 'Ready' && e.preventDefault()}
                        >
                            Visit Store
                        </a>
                        <button
                            onClick={() => handleDelete(store.name)}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StoreList;
