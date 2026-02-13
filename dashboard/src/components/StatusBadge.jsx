import React from 'react';

const StatusBadge = ({ status }) => {
    let colorClass = "bg-gray-500/20 text-gray-400 border-gray-500/50";
    let label = status || "Unknown";
    let animate = false;

    switch (status) {
        case 'Ready':
        case 'Active':
            colorClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
            break;
        case 'Provisioning':
        case 'ContainerCreating':
        case 'Pending':
            colorClass = "bg-amber-500/20 text-amber-400 border-amber-500/50";
            animate = true;
            break;
        case 'Terminating':
        case 'Deleting':
        case 'Failed':
            colorClass = "bg-rose-500/20 text-rose-400 border-rose-500/50";
            break;
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${animate ? 'animate-pulse' : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'Ready' ? 'bg-emerald-400' : status === 'Provisioning' ? 'bg-amber-400' : 'bg-current'}`}></span>
            {label}
        </span>
    );
};

export default StatusBadge;
