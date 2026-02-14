# Office Tracker

A web application to track office attendance based on the Irish working calendar. Calculate required office days (50% of working days), manage annual leave, and monitor your monthly balance.

## Features

- 🇮🇪 **Irish Working Calendar**: Automatic calculation of working days based on Irish public holidays
- 📊 **50% Office Requirement**: Tracks your required office days (50% of working days)
- 🏖️ **Annual Leave Management**: Log your annual leave days
- ✅ **Office Day Tracking**: Mark days you attend the office
- 📈 **Balance Tracking**: See if you're ahead, behind, or on target
- 👥 **Multi-user Support**: Separate tracking for each user
- 🔐 **User Authentication**: Secure registration and login system
- � **Password Reset**: In-app password reset with token-based verification
- �📱 **Responsive Design**: Works on desktop and mobile

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or navigate to the repository**

```bash
cd office-tracker
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` and set your `SESSION_SECRET`:

```
PORT=3000
SESSION_SECRET=your-secure-random-secret-key-here
NODE_ENV=development
```

4. **Start the application**

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

5. **Open your browser**

Navigate to `http://localhost:3000`

## Usage

### First Time Setup

1. Click **Register** and create an account with your email, name, and password
2. You'll be automatically logged in

### Password Reset

If you forget your password:

1. On the **Login** page, click **"Forgot your password?"**
2. Enter your email address
3. A reset token will be generated and displayed
4. Enter your new password
5. Your password will be reset immediately

### Tracking Your Office Days

1. **View Current Month**: The dashboard shows your current month's statistics
2. **Navigate Months**: Use the arrow buttons to move between months
3. **Mark Office Days**: Click on any working day and select "Office Day"
4. **Add Annual Leave**: Click on any working day and select "Annual Leave"
5. **Remove Days**: Click on marked days to remove them

### Understanding the Dashboard

- **Working Days**: Total working days in the month (excluding weekends and public holidays)
- **Annual Leave**: Number of days you've marked as annual leave
- **Required Office Days**: 50% of your actual working days (working days minus annual leave)
- **Office Days Completed**: Number of days you've logged as office attendance
- **Balance**: Shows if you're ahead (+), behind (-), or on target (0)

## Deployment

### Deploy to Render

1. Push your code to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repository
4. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `SESSION_SECRET` = random string
     - `NODE_ENV` = `production`
     - `DB_PATH` = `/var/data/office-tracker.db`
5. Add a **Persistent Disk**:
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB (free tier)
6. Deploy!

### Deploy to Railway

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repository
4. Add environment variable `SESSION_SECRET`
5. Deploy automatically

### Deploy to Heroku

```bash
# Install Heroku CLI and login
heroku login

# Create new app
heroku create your-app-name

# Set environment variable
heroku config:set SESSION_SECRET=your-random-secret

# Push to Heroku
git push heroku main

# Open your app
heroku open
```

### Deploy to fly.io

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Login: `fly auth login`
3. Launch: `fly launch`
4. Set secrets: `fly secrets set SESSION_SECRET=your-random-secret`
5. Deploy: `fly deploy`

## Project Structure

```
office-tracker/
├── server.js           # Express server and API routes
├── database.js         # SQLite database setup and initialization
├── calendar.js         # Irish calendar and working days calculator
├── package.json        # Dependencies and scripts
├── .env.example        # Environment variables template
├── public/             # Frontend files
│   ├── index.html      # Main HTML page
│   ├── styles.css      # Styling
│   └── app.js          # Frontend JavaScript
└── README.md           # This file
```

## Irish Public Holidays

The application automatically accounts for the following Irish public holidays:

- New Year's Day (January 1)
- St. Brigid's Day (First Monday in February)
- St. Patrick's Day (March 17)
- Easter Monday (varies)
- May Day (First Monday in May)
- June Bank Holiday (First Monday in June)
- August Bank Holiday (First Monday in August)
- October Bank Holiday (First Monday in October)
- Christmas Day (December 25)
- St. Stephen's Day (December 26)

## Technical Details

### Backend

- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: bcrypt password hashing with express-session
- **Session Management**: In-memory sessions (configurable for production)

### Frontend

- **Vanilla JavaScript**: No framework dependencies
- **Responsive Design**: CSS Grid and Flexbox
- **Modern UI**: Clean, purple-gradient theme

### Database Schema

- **users**: User accounts (id, email, password hash, name)
- **office_days**: Days user attended office (user_id, date)
- **annual_leave**: Days user took as annual leave (user_id, date)
- **password_reset_tokens**: Password reset tokens with 1-hour expiration (user_id, token, expires_at)

## Security Notes

For production deployment:

1. Use a strong, random `SESSION_SECRET`
2. Enable HTTPS (most hosting platforms do this automatically)
3. Consider using a session store (Redis, PostgreSQL) instead of in-memory sessions
4. Set `NODE_ENV=production`
5. Password reset tokens expire after 1 hour for security
6. Regularly update dependencies

## Customization

### Changing Office Requirement Percentage

Edit `server.js`, line with `Math.ceil(totalWorkingDays * 0.5)`:

```javascript
// Change 0.5 to your desired percentage (e.g., 0.6 for 60%)
const requiredOfficeDays = Math.ceil(totalWorkingDays * 0.5);
```

### Adding More Holidays

Edit `calendar.js` and add to the `getIrishPublicHolidays` function.

## Troubleshooting

**Database not initializing?**
- Check file permissions in the project directory
- Delete `office-tracker.db` and restart

**Session errors?**
- Make sure `SESSION_SECRET` is set in `.env`
- Check that `.env` is in the same directory as `server.js`

**Port already in use?**
- Change `PORT` in `.env` to a different number (e.g., 3001)

## License

MIT License - Feel free to use and modify for your needs.

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
