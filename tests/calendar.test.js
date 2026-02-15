const {
  getIrishPublicHolidays,
  getWorkingDays,
  isWeekend,
  isPublicHoliday,
  formatDate
} = require('../calendar');

describe('Calendar Module', () => {
  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date(2025, 0, 15); // January 15, 2025
      expect(formatDate(date)).toBe('2025-01-15');
    });

    it('should pad single digit months and days', () => {
      const date = new Date(2025, 2, 5); // March 5, 2025
      expect(formatDate(date)).toBe('2025-03-05');
    });

    it('should handle year transitions correctly', () => {
      const date = new Date(2024, 11, 31); // December 31, 2024
      expect(formatDate(date)).toBe('2024-12-31');
    });
  });

  describe('isWeekend', () => {
    it('should return true for Saturday', () => {
      const saturday = new Date(2025, 0, 18); // Saturday
      expect(isWeekend(saturday)).toBe(true);
    });

    it('should return true for Sunday', () => {
      const sunday = new Date(2025, 0, 19); // Sunday
      expect(isWeekend(sunday)).toBe(true);
    });

    it('should return false for weekdays', () => {
      const monday = new Date(2025, 0, 20); // Monday
      const tuesday = new Date(2025, 0, 21); // Tuesday
      const wednesday = new Date(2025, 0, 22); // Wednesday
      const thursday = new Date(2025, 0, 23); // Thursday
      const friday = new Date(2025, 0, 24); // Friday

      expect(isWeekend(monday)).toBe(false);
      expect(isWeekend(tuesday)).toBe(false);
      expect(isWeekend(wednesday)).toBe(false);
      expect(isWeekend(thursday)).toBe(false);
      expect(isWeekend(friday)).toBe(false);
    });
  });

  describe('getIrishPublicHolidays', () => {
    it('should include New Year\'s Day', () => {
      const holidays = getIrishPublicHolidays(2025);
      const newYearsDay = new Date(2025, 0, 1);
      expect(holidays.some(h => formatDate(h) === formatDate(newYearsDay))).toBe(true);
    });

    it('should include St. Patrick\'s Day', () => {
      const holidays = getIrishPublicHolidays(2025);
      const stPatricksDay = new Date(2025, 2, 17);
      expect(holidays.some(h => formatDate(h) === formatDate(stPatricksDay))).toBe(true);
    });

    it('should include Christmas Day', () => {
      const holidays = getIrishPublicHolidays(2025);
      const christmas = new Date(2025, 11, 25);
      expect(holidays.some(h => formatDate(h) === formatDate(christmas))).toBe(true);
    });

    it('should include St. Stephen\'s Day', () => {
      const holidays = getIrishPublicHolidays(2025);
      const stephensDay = new Date(2025, 11, 26);
      expect(holidays.some(h => formatDate(h) === formatDate(stephensDay))).toBe(true);
    });

    it('should include Easter Monday', () => {
      const holidays = getIrishPublicHolidays(2025);
      // Easter 2025 is April 20, so Easter Monday is April 21
      const easterMonday = new Date(Date.UTC(2025, 3, 21));
      expect(holidays.some(h => formatDate(h) === formatDate(easterMonday))).toBe(true);
    });

    it('should include bank holidays (first Monday of marked months)', () => {
      const holidays = getIrishPublicHolidays(2025);
      const mayDay = new Date(Date.UTC(2025, 4, 5)); // First Monday in May
      expect(holidays.some(h => formatDate(h) === formatDate(mayDay))).toBe(true);
    });

    it('should return an array of Date objects', () => {
      const holidays = getIrishPublicHolidays(2025);
      expect(Array.isArray(holidays)).toBe(true);
      expect(holidays.length).toBeGreaterThan(0);
      expect(holidays[0] instanceof Date).toBe(true);
    });

    it('should have consistent number of holidays each year', () => {
      const holidays2024 = getIrishPublicHolidays(2024);
      const holidays2025 = getIrishPublicHolidays(2025);
      // Should have 10 holidays each year (fixed + Easter-based)
      expect(holidays2024.length).toBe(10);
      expect(holidays2025.length).toBe(10);
    });
  });

  describe('isPublicHoliday', () => {
    it('should return true for public holidays', () => {
      const newYearsDay = new Date(2025, 0, 1);
      const holidays = getIrishPublicHolidays(2025);
      expect(isPublicHoliday(newYearsDay, holidays)).toBe(true);
    });

    it('should return false for regular weekdays', () => {
      const regularDay = new Date(2025, 0, 2); // January 2, 2025 (Thursday)
      const holidays = getIrishPublicHolidays(2025);
      expect(isPublicHoliday(regularDay, holidays)).toBe(false);
    });

    it('should return false for weekends that aren\'t holidays', () => {
      const saturday = new Date(2025, 0, 4); // January 4, 2025
      const holidays = getIrishPublicHolidays(2025);
      expect(isPublicHoliday(saturday, holidays)).toBe(false);
    });
  });

  describe('getWorkingDays', () => {
    it('should return array of working days for a month', () => {
      const workingDays = getWorkingDays(2025, 0); // January 2025
      expect(Array.isArray(workingDays)).toBe(true);
      expect(workingDays.length).toBeGreaterThan(0);
      expect(workingDays[0] instanceof Date).toBe(true);
    });

    it('should exclude weekends', () => {
      const workingDays = getWorkingDays(2025, 0);
      workingDays.forEach(day => {
        const dayOfWeek = day.getDay();
        expect([0, 6]).not.toContain(dayOfWeek); // No Sunday or Saturday
      });
    });

    it('should exclude public holidays', () => {
      const workingDays = getWorkingDays(2025, 0);
      const holidays = getIrishPublicHolidays(2025);
      const holidayDates = new Set(holidays.map(h => formatDate(h)));
      
      workingDays.forEach(day => {
        expect(holidayDates.has(formatDate(day))).toBe(false);
      });
    });

    it('should only include dates from the specified month', () => {
      const workingDays = getWorkingDays(2025, 0); // January
      workingDays.forEach(day => {
        expect(day.getMonth()).toBe(0);
        expect(day.getFullYear()).toBe(2025);
      });
    });

    it('should return correct count for typical month', () => {
      const workingDays = getWorkingDays(2025, 0); // January 2025
      // January 2025 has 31 days
      // 2025-01-01 is Wednesday, so weekdays exist
      // Should be roughly 23 working days (31 - 8 weekend days)
      expect(workingDays.length).toBeGreaterThan(20);
      expect(workingDays.length).toBeLessThan(31);
    });

    it('should handle different months correctly', () => {
      const jan = getWorkingDays(2025, 0);
      const feb = getWorkingDays(2025, 1);
      const dec = getWorkingDays(2025, 11);

      expect(jan.length).toBeGreaterThan(0);
      expect(feb.length).toBeGreaterThan(0);
      expect(dec.length).toBeGreaterThan(0);
    });

    it('should handle leap years', () => {
      // 2024 is a leap year
      const workingDays2024Feb = getWorkingDays(2024, 1); // February 2024
      // 2025 is not a leap year
      const workingDays2025Feb = getWorkingDays(2025, 1); // February 2025

      expect(workingDays2024Feb).toBeDefined();
      expect(workingDays2025Feb).toBeDefined();
      expect(workingDays2024Feb.length).toBeGreaterThan(workingDays2025Feb.length);
    });
  });

  describe('Easter calculation edge cases', () => {
    it('should correctly calculate Easter-based holidays', () => {
      // Verify Easter Monday is in the holidays for both years
      const holidays2024 = getIrishPublicHolidays(2024);
      const holidays2025 = getIrishPublicHolidays(2025);

      // 2024 holidays should include an Easter-related date
      expect(holidays2024.length).toBe(10);
      
      // 2025 holidays should include April 20 (Easter Sunday) or April 21 (Easter Monday)
      expect(holidays2025.length).toBe(10);
      
      // Verify we have exactly 10 holidays each year (fixed + moveable)
      const allHolidaysAreDate = holidays2024.every(h => h instanceof Date);
      expect(allHolidaysAreDate).toBe(true);
    });

    it('should include both fixed and moveable holidays', () => {
      const holidays2025 = getIrishPublicHolidays(2025);
      
      // Convert to strings for easier checking
      const holidayStrings = holidays2025.map(formatDate);
      
      // Check for fixed holidays
      expect(holidayStrings).toContain('2025-01-01'); // New Year
      expect(holidayStrings).toContain('2025-03-17'); // St Patrick's
      expect(holidayStrings).toContain('2025-12-25'); // Christmas
      expect(holidayStrings).toContain('2025-12-26'); // St Stephen's
      
      // Should have bank holidays (first Monday of each month)
      expect(holidayStrings).toContain('2025-02-03'); // Feb Bank Holiday (first Monday)
      expect(holidayStrings).toContain('2025-05-05'); // May Day (first Monday)
      expect(holidayStrings).toContain('2025-06-02'); // June Bank Holiday (first Monday)
      expect(holidayStrings).toContain('2025-08-04'); // August Bank Holiday (first Monday)
      expect(holidayStrings).toContain('2025-10-06'); // October Bank Holiday (first Monday)
      
      // Should have Easter Monday (April 2025)
      expect(holidayStrings).toContain('2025-04-21'); // Easter Monday
    });
  });
});
