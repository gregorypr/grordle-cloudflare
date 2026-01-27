// Format a date as 'dd mmm yy' (e.g., 29 Dec 25)
export function formatDateDDMMMYY(dateInput) {
  const date = new Date(dateInput);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-AU', { month: 'short' });
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}
export const getAustralianDate = () => {
  // Use Australian timezone conversion (handles AEST/AEDT automatically)
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
};

export const getDailyIndex = (length, dateStr) => {
  if (!length) return 0;
  const s = dateStr || getAustralianDate();
  let seed = 0;
  for (let i = 0; i < s.length; i++) {
    seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
  }
  return seed % length;
};
