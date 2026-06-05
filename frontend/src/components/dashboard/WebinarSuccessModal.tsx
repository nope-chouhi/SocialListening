import React from 'react';
import { X, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WebinarSuccessModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[450px] overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-8 flex flex-col items-center text-center">
          {/* Success Confetti Animation */}
          <div className="relative mb-6 mt-4">
            <div className="w-20 h-20 bg-emerald-400 rounded-full flex items-center justify-center relative z-10 shadow-lg shadow-emerald-400/30">
              <Check className="w-10 h-10 text-white stroke-[3]" />
            </div>
            
            {/* Confetti particles */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full">
              <div className="absolute -top-4 -left-4 w-2 h-2 bg-emerald-300 rounded-full"></div>
              <div className="absolute top-2 -right-6 w-3 h-3 bg-teal-400 rounded-full"></div>
              <div className="absolute bottom-0 -left-6 w-2 h-4 bg-green-500 rounded-sm rotate-45"></div>
              <div className="absolute -bottom-4 right-0 w-2 h-2 bg-emerald-400 rounded-full"></div>
              <div className="absolute top-10 -right-4 w-1.5 h-3 bg-teal-500 rounded-sm -rotate-45"></div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Success!
          </h2>
          <h3 className="text-xl font-medium text-gray-900 mb-6">
            You have signed up for the webinar.
          </h3>

          <p className="text-gray-600 mb-8">
            Wednesday, June 10, 2026 (Asia/Bangkok). See you!
          </p>

          <button 
            onClick={onClose}
            className="bg-emerald-400 hover:bg-emerald-500 text-white font-bold py-3 px-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
