// State
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentUser = null;
let monthData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// Auth Functions
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            currentUser = await response.json();
            showApp();
            loadMonthData();
        } else {
            showAuth();
        }
    } catch (error) {
        showAuth();
    }
}

function showAuth() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('app-section').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    document.getElementById('user-name').textContent = currentUser.name;
}

function showTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.tab-button');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabs[1].classList.add('active');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = { id: data.userId, name: data.name };
            showApp();
            loadMonthData();
        } else {
            errorDiv.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error';
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = { id: data.userId, name };
            showApp();
            loadMonthData();
        } else {
            errorDiv.textContent = data.error || 'Registration failed';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error';
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showAuth();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Month Navigation
function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    loadMonthData();
}

// Load Month Data
async function loadMonthData() {
    try {
        const response = await fetch(`/api/summary/${currentYear}/${currentMonth + 1}`);
        if (!response.ok) throw new Error('Failed to load data');
        
        monthData = await response.json();
        updateUI();
    } catch (error) {
        console.error('Error loading month data:', error);
    }
}

// Update UI
function updateUI() {
    // Update month title
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('current-month').textContent = 
        `${monthNames[currentMonth]} ${currentYear}`;

    // Update summary cards
    document.getElementById('total-working-days').textContent = monthData.totalWorkingDays;
    document.getElementById('annual-leave-days').textContent = monthData.annualLeaveDays;
    document.getElementById('required-office-days').textContent = monthData.requiredOfficeDays;
    document.getElementById('office-days-completed').textContent = monthData.officeDaysCompleted;
    
    const balance = monthData.balance;
    const balanceCard = document.getElementById('balance-card');
    document.getElementById('balance').textContent = balance >= 0 ? `+${balance}` : balance;
    
    if (balance > 0) {
        balanceCard.classList.remove('negative');
        balanceCard.classList.add('positive');
        document.getElementById('balance-text').textContent = 'Days ahead';
    } else if (balance < 0) {
        balanceCard.classList.remove('positive');
        balanceCard.classList.add('negative');
        document.getElementById('balance-text').textContent = 'Days behind';
    } else {
        balanceCard.classList.remove('positive', 'negative');
        document.getElementById('balance-text').textContent = 'On target';
    }

    // Render calendar
    renderCalendar();
}

// Render Calendar
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sunday

    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.style.fontWeight = 'bold';
        header.style.textAlign = 'center';
        header.style.padding = '10px';
        header.style.color = '#666';
        header.textContent = day;
        calendar.appendChild(header);
    });

    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendar.appendChild(emptyDay);
    }

    // Add days of month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = formatDate(date);
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isOfficeDay = monthData.officeDates.includes(dateStr);
        const isAnnualLeave = monthData.annualLeaveDates.includes(dateStr);
        const isPublicHoliday = monthData.publicHolidayDates && monthData.publicHolidayDates.includes(dateStr);

        if (isAnnualLeave) {
            dayEl.classList.add('annual-leave');
            dayEl.title = 'Annual Leave - Click to remove';
            dayEl.onclick = () => removeAnnualLeave(dateStr);
        } else if (isOfficeDay) {
            dayEl.classList.add('office-day');
            dayEl.title = 'Office Day - Click to remove';
            dayEl.onclick = () => removeOfficeDay(dateStr);
        } else if (isPublicHoliday) {
            dayEl.classList.add('bank-holiday');
            dayEl.title = 'Bank Holiday';
        } else if (isWeekend) {
            dayEl.classList.add('weekend');
            dayEl.title = 'Weekend';
        } else {
            dayEl.classList.add('working-day');
            dayEl.title = 'Click to mark as Office Day or Annual Leave';
            dayEl.onclick = () => showDayOptions(dateStr);
        }

        calendar.appendChild(dayEl);
    }
}

// Day Actions
function showDayOptions(date) {
    // Create modal
    const modal = document.getElementById('day-modal');
    const modalDate = document.getElementById('modal-date');
    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    modalDate.textContent = formattedDate;
    
    // Set up button handlers
    document.getElementById('btn-office').onclick = () => {
        closeModal();
        addOfficeDay(date);
    };
    document.getElementById('btn-annual-leave').onclick = () => {
        closeModal();
        addAnnualLeave(date);
    };
    document.getElementById('btn-cancel').onclick = closeModal;
    document.getElementById('modal-backdrop').onclick = closeModal;
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('day-modal').style.display = 'none';
}

async function addOfficeDay(date) {
    try {
        const response = await fetch('/api/office-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date })
        });

        if (response.ok) {
            loadMonthData();
        }
    } catch (error) {
        console.error('Error adding office day:', error);
    }
}

async function removeOfficeDay(date) {
    if (!confirm('Remove this office day?')) return;

    try {
        const response = await fetch(`/api/office-day/${date}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadMonthData();
        }
    } catch (error) {
        console.error('Error removing office day:', error);
    }
}

async function addAnnualLeave(date) {
    try {
        const response = await fetch('/api/annual-leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date })
        });

        if (response.ok) {
            loadMonthData();
        }
    } catch (error) {
        console.error('Error adding annual leave:', error);
    }
}

async function removeAnnualLeave(date) {
    if (!confirm('Remove this annual leave day?')) return;

    try {
        const response = await fetch(`/api/annual-leave/${date}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadMonthData();
        }
    } catch (error) {
        console.error('Error removing annual leave:', error);
    }
}

// Utility Functions
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
