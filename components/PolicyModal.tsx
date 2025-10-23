import React from 'react';
import { CloseIcon } from './icons';

interface PolicyModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ title, onClose, children }) => {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-amber-500/20 rounded-2xl shadow-2xl shadow-black/50 max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900/80 backdrop-blur-md p-6 z-10 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-3xl font-extrabold text-amber-400">{title}</h2>
            <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-amber-400 transition-colors">
                <CloseIcon className="w-8 h-8" />
            </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar">
            {children}
        </div>
      </div>
    </div>
  );
};
