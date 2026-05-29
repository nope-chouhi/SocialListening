'use client';

import { useState, useEffect } from 'react';

interface ScheduleSelectorProps {
  frequency: 'manual' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  value: {
    hours?: number[];
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    months?: number[];
    time?: string;
  };
  onChange: (value: any) => void;
}

export default function ScheduleSelector({ frequency, value, onChange }: ScheduleSelectorProps) {
  const [selectedHours, setSelectedHours] = useState<number[]>(value.hours || []);
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>(value.daysOfWeek || []);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>(value.daysOfMonth || []);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(value.months || []);
  const [time, setTime] = useState(value.time || '09:00');

  useEffect(() => {
    // Update parent when selections change
    onChange({
      hours: selectedHours,
      daysOfWeek: selectedDaysOfWeek,
      daysOfMonth: selectedDaysOfMonth,
      months: selectedMonths,
      time
    });
  }, [selectedHours, selectedDaysOfWeek, selectedDaysOfMonth, selectedMonths, time]);

  const toggleSelection = (array: number[], value: number, setter: (arr: number[]) => void) => {
    if (array.includes(value)) {
      setter(array.filter(v => v !== value));
    } else {
      setter([...array, value].sort((a, b) => a - b));
    }
  };

  if (frequency === 'manual') {
    return (
      <div className="text-sm text-gray-500">
        Quét thủ công - không cần lịch tự động
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Daily: Select hours */}
      {frequency === 'daily' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Chọn giờ quét (có thể chọn nhiều)
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
              <button
                key={hour}
                type="button"
                onClick={() => toggleSelection(selectedHours, hour, setSelectedHours)}
                className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                  selectedHours.includes(hour)
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                    : 'bg-[#1E293B] text-gray-300 border-gray-700 hover:border-indigo-500/50 hover:bg-[#1E293B]/80'
                }`}
              >
                {hour.toString().padStart(2, '0')}:00
              </button>
            ))}
          </div>
          {selectedHours.length === 0 && (
            <p className="text-xs text-rose-400 mt-2">Vui lòng chọn ít nhất 1 giờ</p>
          )}
        </div>
      )}

      {/* Weekly: Select days of week + time */}
      {frequency === 'weekly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Chọn thứ trong tuần (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {[
                { value: 0, label: 'T2' },
                { value: 1, label: 'T3' },
                { value: 2, label: 'T4' },
                { value: 3, label: 'T5' },
                { value: 4, label: 'T6' },
                { value: 5, label: 'T7' },
                { value: 6, label: 'CN' }
              ].map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfWeek, day.value, setSelectedDaysOfWeek)}
                  className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                    selectedDaysOfWeek.includes(day.value)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-[#1E293B] text-gray-300 border-gray-700 hover:border-indigo-500/50 hover:bg-[#1E293B]/80'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {selectedDaysOfWeek.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">Vui lòng chọn ít nhất 1 ngày</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Giờ quét
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            />
          </div>
        </>
      )}

      {/* Monthly: Select days of month + time */}
      {frequency === 'monthly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Chọn ngày trong tháng (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfMonth, day, setSelectedDaysOfMonth)}
                  className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                    selectedDaysOfMonth.includes(day)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-[#1E293B] text-gray-300 border-gray-700 hover:border-indigo-500/50 hover:bg-[#1E293B]/80'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDaysOfMonth.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">Vui lòng chọn ít nhất 1 ngày</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Giờ quét
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            />
          </div>
        </>
      )}

      {/* Yearly: Select months + days + time */}
      {frequency === 'yearly' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Chọn tháng (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleSelection(selectedMonths, month, setSelectedMonths)}
                  className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                    selectedMonths.includes(month)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-[#1E293B] text-gray-300 border-gray-700 hover:border-indigo-500/50 hover:bg-[#1E293B]/80'
                  }`}
                >
                  T{month}
                </button>
              ))}
            </div>
            {selectedMonths.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">Vui lòng chọn ít nhất 1 tháng</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Chọn ngày trong tháng (có thể chọn nhiều)
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelection(selectedDaysOfMonth, day, setSelectedDaysOfMonth)}
                  className={`px-3 py-2 text-sm rounded-xl border transition-colors ${
                    selectedDaysOfMonth.includes(day)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                      : 'bg-[#1E293B] text-gray-300 border-gray-700 hover:border-indigo-500/50 hover:bg-[#1E293B]/80'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {selectedDaysOfMonth.length === 0 && (
              <p className="text-xs text-rose-400 mt-2">Vui lòng chọn ít nhất 1 ngày</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Giờ quét
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            />
          </div>
        </>
      )}
    </div>
  );
}
