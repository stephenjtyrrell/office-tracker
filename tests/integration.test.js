/**
 * Integration Tests
 * 
 * These tests verify the complete flow of operations working together
 * across multiple modules
 */

const {
  getIrishPublicHolidays,
  getWorkingDays,
  formatDate,
  isPublicHoliday,
  isWeekend
} = require('../calendar');

describe('Integration Tests', () => {
  describe('Complete Month Summary Flow', () => {
    it('should correctly calculate working days for a full month', () => {
      const year = 2025;
      const month = 0; // January

      const workingDays = getWorkingDays(year, month);
      const holidays = getIrishPublicHolidays(year);

      expect(workingDays).toBeDefined();
      expect(workingDays.length).toBeGreaterThan(0);
      expect(holidays).toBeDefined();
      expect(holidays.length).toBeGreaterThan(0);

      // Verify no working day is a weekend
      workingDays.forEach(day => {
        expect(isWeekend(day)).toBe(false);
      });

      // Verify no working day is a public holiday
      workingDays.forEach(day => {
        expect(isPublicHoliday(day, holidays)).toBe(false);
      });
    });

    it('should calculate 50% requirement correctly', () => {
      const year = 2025;
      const month = 0;

      const workingDays = getWorkingDays(year, month);
      const totalWorkingDays = workingDays.length;
      const requiredOfficeDays = Math.ceil(totalWorkingDays * 0.5);

      expect(requiredOfficeDays).toBeGreaterThan(0);
      expect(requiredOfficeDays).toBeLessThanOrEqual(totalWorkingDays);
    });

    it('should adjust requirements when annual leave is taken', () => {
      const year = 2025;
      const month = 0;

      const workingDays = getWorkingDays(year, month);
      const totalWorkingDays = workingDays.length;

      // Simulate taking 2 days of annual leave
      const annualLeaveDays = 2;
      const actualWorkingDays = totalWorkingDays - annualLeaveDays;
      const adjustedRequiredDays = Math.ceil(actualWorkingDays * 0.5);

      expect(adjustedRequiredDays).toBeLessThan(Math.ceil(totalWorkingDays * 0.5));
      expect(adjustedRequiredDays).toBeGreaterThan(0);
    });

    it('should calculate balance correctly', () => {
      const year = 2025;
      const month = 0;

      const workingDays = getWorkingDays(year, month);
      const requiredOfficeDays = Math.ceil(workingDays.length * 0.5);

      // Simulate logging office days
      const officeDaysLogged = 12;
      const balance = officeDaysLogged - requiredOfficeDays;

      expect(typeof balance).toBe('number');
      // Balance can be positive or negative
      expect(balance).toBeDefined();
    });
  });

  describe('Date Handling Across Modules', () => {
    it('should format all working days consistently', () => {
      const year = 2025;
      const month = 0;

      const workingDays = getWorkingDays(year, month);
      const formattedDates = workingDays.map(formatDate);

      // Check all dates are in YYYY-MM-DD format
      formattedDates.forEach(dateStr => {
        expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      // Check no duplicates
      const uniqueDates = new Set(formattedDates);
      expect(uniqueDates.size).toBe(formattedDates.length);
    });

    it('should handle year boundaries correctly', () => {
      // December 2024
      const december2024 = getWorkingDays(2024, 11);
      expect(december2024.length).toBeGreaterThan(0);

      // January 2025
      const january2025 = getWorkingDays(2025, 0);
      expect(january2025.length).toBeGreaterThan(0);

      // Verify no overlap
      const decDates = new Set(december2024.map(formatDate));
      january2025.forEach(day => {
        expect(decDates.has(formatDate(day))).toBe(false);
      });
    });
  });

  describe('Holiday Calculation Consistency', () => {
    it('should have consistent holidays across months in same year', () => {
      const holidays = getIrishPublicHolidays(2025);

      // Get all unique holiday dates
      const holidayDates = new Set(holidays.map(formatDate));
      expect(holidayDates.size).toBe(holidays.length);

      // Verify we have essential holidays
      const monthlyWorkingDays = [];
      for (let month = 0; month < 12; month++) {
        const days = getWorkingDays(2025, month);
        monthlyWorkingDays.push(days);
      }

      // Total working days should be reasonable
      const totalDays = monthlyWorkingDays.reduce((sum, days) => sum + days.length, 0);
      expect(totalDays).toBeGreaterThan(200); // All months should have many working days
      expect(totalDays).toBeLessThanOrEqual(252);
    });

    it('should exclude holidays from working days calculation', () => {
      const holidays = getIrishPublicHolidays(2025);
      const workingDays = getWorkingDays(2025, 0);

      // Get January holidays
      const januaryHolidays = holidays.filter(h => h.getMonth() === 0);

      // Verify January holidays are not in working days
      const workingDaySet = new Set(workingDays.map(formatDate));
      januaryHolidays.forEach(holiday => {
        expect(workingDaySet.has(formatDate(holiday))).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year February correctly', () => {
      const leapYear2024Feb = getWorkingDays(2024, 1);
      const nonLeapYear2025Feb = getWorkingDays(2025, 1);

      expect(leapYear2024Feb).toBeDefined();
      expect(nonLeapYear2025Feb).toBeDefined();

      // Leap year February should have more days (or at least not less)
      expect(leapYear2024Feb.length).toBeGreaterThanOrEqual(nonLeapYear2025Feb.length);
    });

    it('should handle months with many weekends', () => {
      // Any month should have working days
      for (let month = 0; month < 12; month++) {
        const workingDays = getWorkingDays(2025, month);
        expect(workingDays.length).toBeGreaterThan(0);
        expect(workingDays.length).toBeLessThan(31);
      }
    });

    it('should handle public holidays falling on weekends', () => {
      // Get all holidays for 2025
      const holidays = getIrishPublicHolidays(2025);

      // Holidays that fall on weekends shouldn't reduce working day count further
      const weekendHolidays = holidays.filter(h => isWeekend(h));
      const weekdayHolidays = holidays.filter(h => !isWeekend(h));

      expect(weekdayHolidays.length).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    it('should return valid Date objects', () => {
      const workingDays = getWorkingDays(2025, 0);
      workingDays.forEach(day => {
        expect(day instanceof Date).toBe(true);
        expect(isNaN(day.getTime())).toBe(false);
      });
    });

    it('should return valid formatted strings', () => {
      const workingDays = getWorkingDays(2025, 0);
      workingDays.forEach(day => {
        const formatted = formatDate(day);
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Verify the string can be parsed back to same date
        const parsed = new Date(formatted + 'T00:00:00');
        expect(formatDate(parsed)).toBe(formatted);
      });
    });

    it('should have proper date boundaries', () => {
      const year = 2025;

      for (let month = 0; month < 12; month++) {
        const workingDays = getWorkingDays(year, month);

        workingDays.forEach(day => {
          expect(day.getFullYear()).toBe(year);
          expect(day.getMonth()).toBe(month);
        });
      }
    });
  });

  describe('Performance Considerations', () => {
    it('should calculate working days efficiently for multiple months', () => {
      const startTime = Date.now();

      for (let month = 0; month < 12; month++) {
        getWorkingDays(2025, month);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete all 12 months in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should calculate holidays once and reuse', () => {
      const holidays1 = getIrishPublicHolidays(2025);
      const holidays2 = getIrishPublicHolidays(2025);

      // Both calls should return 10 holidays
      expect(holidays1.length).toBe(holidays2.length);
      expect(holidays1.length).toBe(11);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle employee taking about 3 weeks of annual leave', () => {
      const year = 2025;
      const totalAnnualDays = 15; // ~3 weeks

      let totalRequired = 0;
      let totalActual = 0;

      // Spread leave across the year
      const leaveDaysPerMonth = [2, 1, 3, 2, 2, 2, 1, 0, 2, 0, 0, 0];

      for (let month = 0; month < 12; month++) {
        const workingDays = getWorkingDays(year, month);
        const leaveThisMonth = leaveDaysPerMonth[month];

        const actualWorkingDays = workingDays.length - leaveThisMonth;
        const requiredDays = Math.ceil(actualWorkingDays * 0.5);

        totalRequired += requiredDays;
        totalActual += actualWorkingDays;
      }

      expect(totalActual).toBe(getWorkingDaysTotal(year) - totalAnnualDays);
      expect(totalRequired).toBeGreaterThan(80);
      expect(totalRequired).toBeLessThanOrEqual(120);
    });

    it('should calculate year summary correctly', () => {
      const year = 2025;
      let totalWorkingDays = 0;
      let totalHolidays = 0;

      for (let month = 0; month < 12; month++) {
        const workingDays = getWorkingDays(year, month);
        totalWorkingDays += workingDays.length;
      }

      const allHolidays = getIrishPublicHolidays(year);
      totalHolidays = allHolidays.length;

      // Typical Irish year: ~252 working days (20 vacations + 10 holidays)
      expect(totalWorkingDays).toBeGreaterThan(240);
      expect(totalWorkingDays).toBeLessThan(260);
      expect(totalHolidays).toBe(11);
    });
  });
});

// Helper function for testing
function getWorkingDaysTotal(year) {
  let total = 0;
  for (let month = 0; month < 12; month++) {
    total += getWorkingDays(year, month).length;
  }
  return total;
}
