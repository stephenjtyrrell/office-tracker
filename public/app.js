// State
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentUser = null;
let monthData = null;
let csrfToken = null;
let csrfTokenPromise = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    bindStaticEvents();
    await fetchCSRFToken();
    loadVersion();
    checkAuth();
    setupPasswordToggles();
});

// Fetch CSRF token on app load
async function fetchCSRFToken() {
    if (csrfTokenPromise) {
        return csrfTokenPromise;
    }
    
    csrfTokenPromise = (async () => {
        try {
            const response = await fetch('/api/csrf-token');
            const data = await response.json();
            csrfToken = data.csrfToken;
            return csrfToken;
        } catch (error) {
            console.error('Failed to fetch CSRF token:', error);
            // Retry after 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
            csrfTokenPromise = null;
            return fetchCSRFToken();
        }
    })();
    
    return csrfTokenPromise;
}

async function refreshCSRFToken() {
    csrfToken = null;
    csrfTokenPromise = null;
    return fetchCSRFToken();
}

function setupPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                eyeIcon.textContent = '👁️';
            }
        });
    });
}

async function loadVersion() {
    try {
        const response = await fetch('/api/version');
        const data = await response.json();
        document.getElementById('app-version').textContent = data.version;
    } catch (error) {
        console.error('Failed to load version:', error);
    }
}

function bindStaticEvents() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form-el');
    const registerForm = document.getElementById('register-form-el');
    const logoutButton = document.getElementById('logout-button');
    const prevMonth = document.getElementById('prev-month');
    const nextMonth = document.getElementById('next-month');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login-link');
    const forgotPasswordForm = document.getElementById('forgot-password-form-el');
    const resetPasswordForm = document.getElementById('reset-password-form-el');

    if (tabLogin) tabLogin.addEventListener('click', () => showTab('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => showTab('register'));
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (prevMonth) prevMonth.addEventListener('click', () => changeMonth(-1));
    if (nextMonth) nextMonth.addEventListener('click', () => changeMonth(1));
    if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showPasswordResetForm();
    });
    if (backToLoginLink) backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showTab('login');
    });
    if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    if (resetPasswordForm) resetPasswordForm.addEventListener('submit', handleResetPassword);
}

// Auth Functions
async function fetchWithCSRF(url, options = {}) {
    const { method = 'GET', headers = {}, _csrfRetry = false, ...rest } = options;
    const finalHeaders = { 'Content-Type': 'application/json', ...headers };
    
    // Add CSRF token for state-modifying requests
    const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (unsafeMethods.includes(method.toUpperCase())) {
        // Ensure CSRF token is available
        if (!csrfToken) {
            await fetchCSRFToken();
        }
        if (csrfToken) {
            finalHeaders['X-CSRF-Token'] = csrfToken;
        }
    }
    
    const response = await fetch(url, { method, headers: finalHeaders, ...rest });

    if (unsafeMethods.includes(method.toUpperCase()) && response.status === 403 && !_csrfRetry) {
        await refreshCSRFToken();
        return fetchWithCSRF(url, { method, headers, _csrfRetry: true, ...rest });
    }

    return response;
}

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
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const tabs = document.querySelectorAll('.tab-button');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        forgotPasswordForm.style.display = 'none';
        tabs[0].classList.add('active');
    } else if (tab === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        forgotPasswordForm.style.display = 'none';
        tabs[1].classList.add('active');
    }
}

function showPasswordResetForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const tabs = document.querySelectorAll('.tab-button');
    
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    forgotPasswordForm.style.display = 'block';
    tabs.forEach(t => t.classList.remove('active'));
    
    // Show step 1 and hide step 2
    document.getElementById('reset-step-1').style.display = 'block';
    document.getElementById('reset-step-2').style.display = 'none';
    document.getElementById('forgot-error').textContent = '';
    document.getElementById('reset-error').textContent = '';
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        errorDiv.textContent = '';

        const response = await fetchWithCSRF('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = { id: data.userId, name: data.name };
            await refreshCSRFToken();
            showApp();
            loadMonthData();
        } else {
            errorDiv.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';
        errorDiv.textContent = '';

        const response = await fetchWithCSRF('/api/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = { id: data.userId, name };
            await refreshCSRFToken();
            showApp();
            loadMonthData();
        } else {
            errorDiv.textContent = data.error || 'Registration failed';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleLogout() {
    try {
        await fetchWithCSRF('/api/logout', { method: 'POST' });
        currentUser = null;
        csrfToken = null;
        csrfTokenPromise = null;
        showAuth();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Password Reset Handlers
async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const errorDiv = document.getElementById('forgot-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        errorDiv.textContent = '';

        const response = await fetchWithCSRF('/api/password-reset/request', {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            // Show step 2 with the token
            document.getElementById('reset-step-1').style.display = 'none';
            document.getElementById('reset-step-2').style.display = 'block';
            document.getElementById('reset-token').value = data.token || '';
            errorDiv.className = 'success-message';
            errorDiv.textContent = data.token
                ? ''
                : 'If the email exists, you will receive a reset token.';
        } else {
            errorDiv.textContent = data.error || 'Failed to process request';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleResetPassword(event) {
    event.preventDefault();
    const token = document.getElementById('reset-token').value;
    const password = document.getElementById('reset-new-password').value;
    const errorDiv = document.getElementById('reset-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Resetting...';
        errorDiv.textContent = '';

        const response = await fetchWithCSRF('/api/password-reset/confirm', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });

        const data = await response.json();

        if (response.ok) {
            errorDiv.textContent = '';
            errorDiv.className = 'success-message';
            errorDiv.textContent = 'Password reset successful! Redirecting to login...';
            
            setTimeout(() => {
                // Clear all form fields
                document.getElementById('login-email').value = '';
                document.getElementById('login-password').value = '';
                document.getElementById('forgot-email').value = '';
                document.getElementById('reset-new-password').value = '';
                document.getElementById('reset-token').value = '';
                document.getElementById('reset-step-1').style.display = 'block';
                document.getElementById('reset-step-2').style.display = 'none';
                showTab('login');
            }, 2000);
        } else {
            errorDiv.className = 'error-message';
            errorDiv.textContent = data.error || 'Failed to reset password';
        }
    } catch (error) {
        errorDiv.className = 'error-message';
        errorDiv.textContent = 'Connection error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
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
        const response = await fetchWithCSRF('/api/office-day', {
            method: 'POST',
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
        const response = await fetchWithCSRF(`/api/office-day/${date}`, {
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
        const response = await fetchWithCSRF('/api/annual-leave', {
            method: 'POST',
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
        const response = await fetchWithCSRF(`/api/annual-leave/${date}`, {
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
