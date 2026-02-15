# Office Tracker

A web application to track office attendance based on the Irish working calendar.

## Features

- 🇮🇪 Irish working calendar with automatic public holiday calculation
- 50% office requirement tracking
- Annual leave management
- Monthly balance tracking
- Multi-user support with secure authentication
- Responsive design

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file with:

```
PORT=3000
SESSION_SECRET=your-secure-random-secret
DATABASE_URL=postgres://user:password@localhost/office_tracker
NODE_ENV=development
```

### Run Locally

```bash
npm start
```

Navigate to `http://localhost:3000`

## Usage

1. **Register** for an account
2. **Track office days** by clicking working days and selecting "Office Day"
3. **Log annual leave** as needed
4. **View your balance** to see if you're on target

The app automatically calculates:
- Working days (excluding weekends and Irish public holidays)
- Required office days (50% of actual working days)
- Your current balance

## Stack

- **Backend**: Express.js + PostgreSQL
- **Frontend**: Vanilla JavaScript + CSS
- **Authentication**: bcrypt + express-session

## License

MIT
