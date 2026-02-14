// Irish public holidays calculator
// Note: Some holidays are fixed, others are calculated

function getEasterSunday(year) {
  // Meeus/Jones/Butcher algorithm for Gregorian calendar
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getIrishPublicHolidays(year) {
  const holidays = [];

  // Fixed holidays
  holidays.push(new Date(year, 0, 1));   // New Year's Day
  holidays.push(new Date(year, 2, 17));  // St. Patrick's Day
  holidays.push(new Date(year, 11, 25)); // Christmas Day
  holidays.push(new Date(year, 11, 26)); // St. Stephen's Day

  // Easter-based holidays
  const easter = getEasterSunday(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push(easterMonday); // Easter Monday

  // First Monday in February, May, June, August, October
  holidays.push(getNthWeekdayOfMonth(year, 1, 1, 1));  // St. Brigid's Day
  holidays.push(getNthWeekdayOfMonth(year, 4, 1, 1));  // May Day
  holidays.push(getNthWeekdayOfMonth(year, 5, 1, 1));  // June Bank Holiday
  holidays.push(getNthWeekdayOfMonth(year, 7, 1, 1));  // August Bank Holiday
  holidays.push(getNthWeekdayOfMonth(year, 9, 1, 1));  // October Bank Holiday

  return holidays;
}

function getNthWeekdayOfMonth(year, month, weekday, n) {
  // weekday: 0 = Sunday, 1 = Monday, etc.
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  let diff = weekday - firstWeekday;
  if (diff < 0) diff += 7;
  const date = 1 + diff + (n - 1) * 7;
  return new Date(year, month, date);
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

function isPublicHoliday(date, holidays) {
  const dateStr = date.toISOString().split('T')[0];
  return holidays.some(holiday => holiday.toISOString().split('T')[0] === dateStr);
}

function getWorkingDays(year, month) {
  const holidays = getIrishPublicHolidays(year);
  const workingDays = [];
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    const currentDate = new Date(date);
    if (!isWeekend(currentDate) && !isPublicHoliday(currentDate, holidays)) {
      workingDays.push(new Date(currentDate));
    }
  }
  
  return workingDays;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

module.exports = {
  getIrishPublicHolidays,
  getWorkingDays,
  isWeekend,
  isPublicHoliday,
  formatDate
};
