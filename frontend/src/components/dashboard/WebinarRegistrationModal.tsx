import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { webinar } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WebinarRegistrationModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [time, setTime] = useState('3:00 PM');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.email) {
      setEmail(user.email);
    }
    // Do NOT auto-fill name per requirement
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Bạn phải đăng nhập hoặc có email để đăng ký.");
      return;
    }
    if (!name) {
      setErrorMsg("Vui lòng nhập tên của bạn.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await webinar.register({
        email,
        name,
        webinar_title: "Get a Social Listening certificate with Nope360",
        webinar_time: `Wednesday, June 10, 2026 ${time}`,
        timezone: "Asia/Bangkok"
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to register', error);
      setErrorMsg(error.response?.data?.detail || "Không gửi được email xác nhận. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[500px] overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-6 flex flex-col items-center">
          {/* Header Illustration */}
          <div className="w-48 h-32 relative mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center relative border border-teal-100">
                <div className="w-16 h-16 bg-teal-100/50 rounded-full"></div>
                <div className="absolute top-0 right-0 -mr-4 -mt-2 bg-blue-500 text-white p-1.5 rounded text-xs">
                  <div className="w-4 h-1 bg-white/50 rounded mb-1"></div>
                  <div className="w-6 h-1 bg-white/50 rounded"></div>
                </div>
                <div className="absolute bottom-2 right-0 -mr-6 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                  72
                </div>
                {/* Minimal representation of woman */}
                <div className="absolute w-12 h-12 flex flex-col items-center justify-end mt-4">
                  <div className="w-6 h-6 border-2 border-teal-600 rounded-full mb-0.5"></div>
                  <div className="w-10 h-6 border-2 border-teal-600 rounded-t-xl border-b-0"></div>
                </div>
              </div>
            </div>
            {/* Minimal line chart representation */}
            <div className="absolute top-0 left-0 w-24 h-16 bg-white border border-gray-200 rounded shadow-sm p-1.5">
              <div className="w-full h-full border-b border-l border-gray-200 relative">
                <svg className="w-full h-full absolute inset-0 text-teal-500" viewBox="0 0 100 50" preserveAspectRatio="none">
                  <polyline points="0,40 25,20 50,30 75,10 100,20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <p className="text-gray-500 text-sm font-medium mb-1">Upcoming webinar:</p>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6 px-4">
            Get a Social Listening certificate with Nope360
          </h2>

          <div className="flex items-center text-blue-600 font-bold mb-8">
            <span className="w-5 h-5 flex items-center justify-center bg-blue-100 rounded mr-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            Wednesday, June 10, 2026
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">
                Choose your preferred time <span className="font-normal text-gray-500">(Asia/Bangkok):</span>
              </label>
              <select 
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236B7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-[right_16px_center] bg-no-repeat"
              >
                <option value="3:00 PM">Wednesday, June 10, 2026 3:00 PM</option>
                <option value="8:00 PM">Wednesday, June 10, 2026 8:00 PM</option>
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">E-mail</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  required
                  disabled
                  readOnly
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed focus:outline-none"
                />
              </div>
              <div className="flex-1 relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-blue-600 font-medium z-10">Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white border-2 border-blue-500 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-4 flex justify-center pb-2">
              <button 
                type="submit"
                disabled={loading}
                className="bg-emerald-400 hover:bg-emerald-500 text-white font-bold py-3 px-16 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
            
            <p className="text-center text-xs text-gray-500 mt-2">
              By registering I accept the <a href="#" className="text-emerald-500 hover:underline">information clause</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
