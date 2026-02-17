import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, 5000);

        return () => clearTimeout(timer);
    }, [id, onClose]);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />
    };

    const styles = {
        success: 'border-emerald-500/50 bg-emerald-950/80',
        error: 'border-red-500/50 bg-red-950/80',
        info: 'border-blue-500/50 bg-blue-950/80'
    };

    return (
        <div className={`flex items-center gap-3 p-4 mb-3 rounded-lg border backdrop-blur w-80 shadow-lg animate-in slide-in-from-bottom-2 duration-300 ${styles[type]}`}>
            {icons[type]}
            <p className="flex-1 text-sm font-medium text-slate-200">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="text-slate-500 hover:text-white transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
