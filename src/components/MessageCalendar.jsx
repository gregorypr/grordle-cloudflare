import { useState, useEffect } from "react";
import { fetchJson } from "../utils/apiClient";
import { API_BASE } from "../constants/gameConstants";

export default function MessageCalendar({ playerName, onClose }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [messages, setMessages] = useState({});
  const [editMessage, setEditMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Load messages for current month
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const result = await fetchJson(
          `${API_BASE}/motd?month=${currentMonth + 1}&year=${currentYear}`
        );
        if (result.ok) {
          setMessages(result.messages || {});
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();
  }, [currentMonth, currentYear]);

  // Get days in month
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday)
  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
  };

  const handleDateClick = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setEditMessage(messages[dateStr]?.message || "");
  };

  const handleSave = async () => {
    if (!selectedDate) return;

    setIsSaving(true);
    try {
      const result = await fetchJson(`${API_BASE}/motd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          message: editMessage,
          playerName
        })
      });

      if (result.ok) {
        // Update local state
        if (editMessage.trim()) {
          setMessages(prev => ({
            ...prev,
            [selectedDate]: { message: editMessage.trim(), createdBy: playerName }
          }));
        } else {
          // Remove if empty
          setMessages(prev => {
            const updated = { ...prev };
            delete updated[selectedDate];
            return updated;
          });
        }
        setSelectedDate(null);
      }
    } catch (err) {
      console.error("Error saving message:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  // Build calendar grid
  const calendarDays = [];
  // Empty cells for days before first of month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const isToday = (day) => {
    return day === today.getDate() &&
           currentMonth === today.getMonth() &&
           currentYear === today.getFullYear();
  };

  const hasMessage = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return !!messages[dateStr]?.message;
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return "";
    const date = new Date(selectedDate + "T00:00:00");
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with close button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Message Calendar</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h3 className="text-xl font-semibold text-white">
          {monthNames[currentMonth]} {currentYear}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white/10 rounded-lg p-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="text-center text-purple-300 text-sm font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        {isLoading ? (
          <div className="text-center text-white py-8">Loading...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <div key={index} className="aspect-square">
                {day && (
                  <button
                    onClick={() => handleDateClick(day)}
                    className={`w-full h-full rounded-lg flex flex-col items-center justify-center transition relative
                      ${isToday(day) ? 'bg-purple-600 text-white font-bold' : 'bg-white/5 hover:bg-white/20 text-white'}
                      ${selectedDate === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? 'ring-2 ring-yellow-400' : ''}
                    `}
                  >
                    <span className="text-sm">{day}</span>
                    {hasMessage(day) && (
                      <span className="absolute bottom-1 w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message editor */}
      {selectedDate && (
        <div className="bg-white/10 rounded-lg p-4 space-y-3">
          <h4 className="text-white font-semibold">{formatSelectedDate()}</h4>
          <input
            type="text"
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            placeholder="Enter message (max 50 chars)..."
            maxLength={50}
            className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <div className="flex justify-between items-center">
            <span className="text-purple-300 text-sm">{editMessage.length}/50</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          {messages[selectedDate]?.createdBy && (
            <p className="text-purple-300 text-xs">
              Last edited by: {messages[selectedDate].createdBy}
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 justify-center text-sm text-purple-300">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-purple-600 rounded"></span>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
          <span>Has message</span>
        </div>
      </div>
    </div>
  );
}
