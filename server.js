const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Set timezone if provided
if (process.env.TZ) {
    process.env.TZ = process.env.TZ;
}

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, 'data', 'bank_account_data.json');

// In-memory storage for serverless environments
let memoryStorage = null;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'bank-app-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ========== UTILITY FUNCTIONS ==========

// Date utility functions
function getNextSaturday(date) {
    const localDate = new Date(date);
    // Ensure we're working with the date in local timezone
    const day = localDate.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    
    if (daysUntilSaturday === 0) {
        // It's already Saturday, return next Saturday
        localDate.setDate(localDate.getDate() + 7);
    } else {
        localDate.setDate(localDate.getDate() + daysUntilSaturday);
    }
    
    return localDate;
}

function getNextSunday(date) {
    const localDate = new Date(date);
    // Ensure we're working with the date in local timezone
    const day = localDate.getDay();
    const daysUntilSunday = (7 - day) % 7;
    
    if (daysUntilSunday === 0) {
        // It's already Sunday, return next Sunday
        localDate.setDate(localDate.getDate() + 7);
    } else {
        localDate.setDate(localDate.getDate() + daysUntilSunday);
    }
    
    return localDate;
}

function getSaturdaysBetween(startDate, endDate) {
    const saturdays = [];
    let current = getNextSaturday(startDate);
    while (current <= endDate) {
        saturdays.push(new Date(current));
        current.setDate(current.getDate() + 7);
    }
    return saturdays;
}

function getSundaysBetween(startDate, endDate) {
    const sundays = [];
    let current = getNextSunday(startDate);
    while (current <= endDate) {
        sundays.push(new Date(current));
        current.setDate(current.getDate() + 7);
    }
    return sundays;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDate(dateString) {
    // Parse as local date, not UTC
    const [year, month, day] = dateString.split('-').map(num => parseInt(num));
    return new Date(year, month - 1, day);
}

// Authentication
function authenticate(username, password) {
    const validUser = "dad";
    const validPassHash = crypto.createHash('sha256').update("Pass1345").digest('hex');
    const userPassHash = crypto.createHash('sha256').update(password).digest('hex');
    return username === validUser && userPassHash === validPassHash;
}

// Data management
function loadAccountData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            
            // Convert date strings back to Date objects
            if (data.start_date) data.start_date = parseDate(data.start_date);
            if (data.settings_change_date) data.settings_change_date = parseDate(data.settings_change_date);
            if (data.last_processed_saturday) data.last_processed_saturday = parseDate(data.last_processed_saturday);
            if (data.last_processed_sunday) data.last_processed_sunday = parseDate(data.last_processed_sunday);
            
            // Convert transaction dates
            if (data.manual_txns) {
                data.manual_txns.forEach(txn => {
                    txn.Date = parseDate(txn.Date);
                });
            }
            if (data.auto_deposits) {
                data.auto_deposits.forEach(txn => {
                    txn.Date = parseDate(txn.Date);
                });
            }
            
            return data;
        }
    } catch (error) {
        console.error('Error loading account data:', error);
    }
    
    // Default data structure
    return {
        account_holder: "My",
        initial_balance: 0.0,
        start_date: new Date('2024-01-01'),
        initial_allowance: 5.0,
        initial_interest: 1.0,
        current_allowance: 5.0,
        current_interest: 1.0,
        settings_change_date: null,
        manual_txns: [],
        last_processed_saturday: null,
        last_processed_sunday: null,
        auto_deposits: []
    };
}

function saveAccountData(data) {
    try {
        // Create a copy for saving with dates converted to strings
        const saveData = { ...data };
        
        // Convert dates to strings
        if (saveData.start_date) saveData.start_date = formatDate(saveData.start_date);
        if (saveData.settings_change_date) saveData.settings_change_date = formatDate(saveData.settings_change_date);
        if (saveData.last_processed_saturday) saveData.last_processed_saturday = formatDate(saveData.last_processed_saturday);
        if (saveData.last_processed_sunday) saveData.last_processed_sunday = formatDate(saveData.last_processed_sunday);
        
        // Convert transaction dates
        if (saveData.manual_txns) {
            saveData.manual_txns = saveData.manual_txns.map(txn => ({
                ...txn,
                Date: formatDate(txn.Date)
            }));
        }
        if (saveData.auto_deposits) {
            saveData.auto_deposits = saveData.auto_deposits.map(txn => ({
                ...txn,
                Date: formatDate(txn.Date)
            }));
        }
        
        // Ensure data directory exists
        const dataDir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(saveData, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving account data:', error);
        return false;
    }
}

function processNewDeposits(data) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Determine starting points for processing
    const saturdayStart = data.last_processed_saturday 
        ? new Date(data.last_processed_saturday.getTime() + 24 * 60 * 60 * 1000)
        : data.start_date;
    
    const sundayStart = data.last_processed_sunday
        ? new Date(data.last_processed_sunday.getTime() + 24 * 60 * 60 * 1000)
        : data.start_date;
    
    // Get all dates that need processing
    const saturdays = getSaturdaysBetween(saturdayStart, today);
    const sundays = getSundaysBetween(sundayStart, today);
    
    // Combine and sort all dates
    const allDates = [
        ...saturdays.map(date => ({ date, type: 'saturday' })),
        ...sundays.map(date => ({ date, type: 'sunday' }))
    ].sort((a, b) => a.date - b.date);
    
    if (allDates.length > 0) {
        // Calculate running balance
        const allTxns = [...data.auto_deposits, ...data.manual_txns];
        allTxns.sort((a, b) => a.Date - b.Date);
        
        let balance = data.initial_balance;
        for (const txn of allTxns) {
            balance += txn.Amount;
        }
        
        // Process each date
        for (const { date, type } of allDates) {
            // Determine which settings to use
            const useCurrentSettings = data.settings_change_date && date >= data.settings_change_date;
            const allowance = useCurrentSettings ? data.current_allowance : data.initial_allowance;
            const interestRate = useCurrentSettings ? data.current_interest : data.initial_interest;
            
            if (type === 'saturday') {
                // Add allowance
                data.auto_deposits.push({
                    Date: new Date(date),
                    Type: "Weekly Allowance",
                    Amount: allowance
                });
                balance += allowance;
                data.last_processed_saturday = new Date(date);
            } else if (type === 'sunday') {
                // Calculate interest on current balance
                const interest = balance * (interestRate / 100);
                if (interest > 0) {
                    data.auto_deposits.push({
                        Date: new Date(date),
                        Type: `Interest @ ${interestRate}% 😊`,
                        Amount: interest
                    });
                    balance += interest;
                }
                data.last_processed_sunday = new Date(date);
            }
        }
        
        saveAccountData(data);
        return true;
    }
    return false;
}

function recalculateFromTransaction(data, transactionDate) {
    // Find the earliest date we need to recalculate from
    const recalcFromDate = new Date(transactionDate);
    
    // Remove auto deposits that occurred on or after the transaction date
    const preservedDeposits = data.auto_deposits.filter(deposit => 
        new Date(deposit.Date) < recalcFromDate
    );
    
    // Reset last processed dates if they're after our recalc date
    const lastSaturday = data.last_processed_saturday ? new Date(data.last_processed_saturday) : null;
    const lastSunday = data.last_processed_sunday ? new Date(data.last_processed_sunday) : null;
    
    if (lastSaturday && lastSaturday >= recalcFromDate) {
        data.last_processed_saturday = null;
    }
    if (lastSunday && lastSunday >= recalcFromDate) {
        data.last_processed_sunday = null;
    }
    
    // Update auto_deposits with preserved deposits
    data.auto_deposits = preservedDeposits;
    
    // Process new deposits from the recalc date forward
    processNewDeposits(data);
    saveAccountData(data);
}

function recalculateAllDeposits(data) {
    data.auto_deposits = [];
    data.last_processed_saturday = null;
    data.last_processed_sunday = null;
    processNewDeposits(data);
    saveAccountData(data);
}

function getCurrentTime() {
    return new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

// Currency formatting helper
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// ========== API ROUTES ==========

// Authentication
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (authenticate(username, password)) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
    console.log('Auth status check - Session ID:', req.sessionID, 'Authenticated:', !!req.session.authenticated);
    res.json({ 
        authenticated: !!req.session.authenticated,
        sessionId: req.sessionID,
        debug: process.env.NODE_ENV !== 'production' ? req.session : undefined
    });
});

// Account data
app.get('/api/account', (req, res) => {
    try {
        const data = loadAccountData();
        processNewDeposits(data);
        
        // Calculate current balance
        const allTxns = [...data.auto_deposits, ...data.manual_txns];
        allTxns.sort((a, b) => a.Date - b.Date);
        
        let currentBalance = data.initial_balance;
        const transactions = [];
        
        for (let i = 0; i < allTxns.length; i++) {
            const txn = allTxns[i];
            currentBalance += txn.Amount;
            transactions.push({
                Date: formatDate(txn.Date),
                Type: txn.Type,
                Amount: txn.Amount,
                Balance: currentBalance,
                isManual: data.manual_txns.includes(txn),
                manualIndex: data.manual_txns.indexOf(txn)
            });
        }
        
        // Calculate next deposit info
        const today = new Date();
        const todayDay = today.getDay();
        
        // If today is Saturday, next Saturday is in 7 days
        const nextSaturday = todayDay === 6 ? 
            new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) : 
            getNextSaturday(today);
            
        // If today is Sunday, next Sunday is in 7 days
        const nextSunday = todayDay === 0 ? 
            new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) : 
            getNextSunday(today);
        
        const daysUntilSaturday = Math.floor((nextSaturday - today) / (24 * 60 * 60 * 1000));
        const daysUntilSunday = Math.floor((nextSunday - today) / (24 * 60 * 60 * 1000));
        
        res.json({
            account_holder: data.account_holder,
            initial_balance: data.initial_balance,
            start_date: formatDate(data.start_date),
            initial_allowance: data.initial_allowance,
            initial_interest: data.initial_interest,
            current_allowance: data.current_allowance,
            current_interest: data.current_interest,
            settings_change_date: data.settings_change_date ? formatDate(data.settings_change_date) : null,
            current_balance: currentBalance,
            transactions: transactions,
            current_time: getCurrentTime(),
            next_saturday: formatDate(nextSaturday),
            next_sunday: formatDate(nextSunday),
            days_until_saturday: daysUntilSaturday,
            days_until_sunday: daysUntilSunday,
            is_saturday: todayDay === 6,
            is_sunday: todayDay === 0,
            debug_info: {
                today_date: formatDate(today),
                today_day: todayDay,
                day_names: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todayDay],
                next_saturday_date: formatDate(nextSaturday),
                next_sunday_date: formatDate(nextSunday),
                server_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                server_time: new Date().toString()
            }
        });
    } catch (error) {
        console.error('Error getting account data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update settings
app.post('/api/settings/initial', (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const data = loadAccountData();
        const { account_holder, initial_balance, start_date, initial_allowance, initial_interest } = req.body;
        
        if (account_holder !== undefined && account_holder !== null && account_holder !== '') {
            data.account_holder = account_holder;
        }
        if (initial_balance !== undefined && initial_balance !== null && initial_balance !== '') {
            const balanceValue = parseFloat(initial_balance);
            if (!isNaN(balanceValue) && balanceValue >= 0) {
                data.initial_balance = balanceValue;
            }
        }
        if (start_date !== undefined && start_date !== null && start_date !== '') {
            data.start_date = parseDate(start_date);
        }
        if (initial_allowance !== undefined && initial_allowance !== null && initial_allowance !== '') {
            const allowanceValue = parseFloat(initial_allowance);
            if (!isNaN(allowanceValue) && allowanceValue >= 0) {
                data.initial_allowance = allowanceValue;
            }
        }
        if (initial_interest !== undefined && initial_interest !== null && initial_interest !== '') {
            const interestValue = parseFloat(initial_interest);
            if (!isNaN(interestValue) && interestValue >= 0) {
                data.initial_interest = interestValue;
            }
        }
        
        // If current settings haven't been customized, update them too
        if (!data.settings_change_date) {
            data.current_allowance = data.initial_allowance;
            data.current_interest = data.initial_interest;
        }
        
        recalculateAllDeposits(data);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating initial settings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/api/settings/current', (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const data = loadAccountData();
        const { current_allowance, current_interest } = req.body;
        
        console.log('Updating current settings:', { current_allowance, current_interest });
        
        if (current_allowance !== undefined && current_allowance !== null && current_allowance !== '') {
            const allowanceValue = parseFloat(current_allowance);
            if (!isNaN(allowanceValue) && allowanceValue >= 0) {
                data.current_allowance = allowanceValue;
            }
        }
        if (current_interest !== undefined && current_interest !== null && current_interest !== '') {
            const interestValue = parseFloat(current_interest);
            if (!isNaN(interestValue) && interestValue >= 0) {
                data.current_interest = interestValue;
            }
        }
        
        // Set change date if not already set
        if (!data.settings_change_date) {
            data.settings_change_date = new Date();
        }
        
        const saved = saveAccountData(data);
        if (saved) {
            console.log('Updated current settings successfully:', { 
                current_allowance: data.current_allowance, 
                current_interest: data.current_interest 
            });
            res.json({ success: true });
        } else {
            console.error('Failed to save account data');
            res.status(500).json({ success: false, message: 'Failed to save data' });
        }
    } catch (error) {
        console.error('Error updating current settings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add manual transaction
app.post('/api/transaction', (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const data = loadAccountData();
        const { type, name, amount, date } = req.body;
        
        if (!name || !amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid transaction data' });
        }
        
        const transactionAmount = type === 'Deposit' ? parseFloat(amount) : -parseFloat(amount);
        const transactionDate = date ? parseDate(date) : new Date();
        
        data.manual_txns.push({
            Date: transactionDate,
            Type: name,
            Amount: transactionAmount
        });
        
        // Recalculate deposits from the transaction date forward
        recalculateFromTransaction(data, transactionDate);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Delete manual transaction
app.delete('/api/transaction/:index', (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const data = loadAccountData();
        const index = parseInt(req.params.index);
        
        if (index < 0 || index >= data.manual_txns.length) {
            return res.status(400).json({ success: false, message: 'Invalid transaction index' });
        }
        
        // Get the transaction date before removing it
        const transactionDate = data.manual_txns[index].Date;
        
        // Remove the transaction
        data.manual_txns.splice(index, 1);
        
        // Recalculate deposits from the transaction date forward
        recalculateFromTransaction(data, transactionDate);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Savings goal calculator
app.post('/api/calculate-goal', (req, res) => {
    try {
        const data = loadAccountData();
        const { goal_amount, goal_date } = req.body;
        
        const goalAmount = parseFloat(goal_amount);
        const goalDate = parseDate(goal_date);
        const today = new Date();
        
        // Calculate current balance
        const allTxns = [...data.auto_deposits, ...data.manual_txns];
        let currentBalance = data.initial_balance;
        for (const txn of allTxns) {
            currentBalance += txn.Amount;
        }
        
        if (goalAmount <= currentBalance) {
            return res.json({
                success: true,
                already_reached: true,
                current_balance: currentBalance,
                goal_amount: goalAmount,
                message: `🎉 Great news! You already have ${formatCurrency(currentBalance)}!`,
                message2: `That's more than your goal of ${formatCurrency(goalAmount)}!`
            });
        }
        
        const nextSaturday = getNextSaturday(today);
        const nextSunday = getNextSunday(today);
        
        const saturdays = getSaturdaysBetween(nextSaturday, goalDate);
        const sundays = getSundaysBetween(nextSunday, goalDate);
        
        if (saturdays.length === 0 && sundays.length === 0) {
            return res.json({
                success: false,
                current_balance: currentBalance,
                goal_amount: goalAmount,
                message: `Your goal date is before the next deposit. You currently have ${formatCurrency(currentBalance)} and need ${formatCurrency(goalAmount - currentBalance)} more to reach your goal.`
            });
        }
        
        // Simulate future balance
        let futureBalance = currentBalance;
        const allDates = [
            ...saturdays.map(date => ({ date, type: 'saturday' })),
            ...sundays.map(date => ({ date, type: 'sunday' }))
        ].sort((a, b) => a.date - b.date);
        
        for (const { type } of allDates) {
            if (type === 'saturday') {
                futureBalance += data.current_allowance;
            } else {
                futureBalance *= (1 + data.current_interest / 100);
            }
        }
        
        const daysUntilGoal = Math.floor((goalDate - today) / (24 * 60 * 60 * 1000));
        
        if (futureBalance >= goalAmount) {
            res.json({
                success: true,
                will_reach: true,
                current_balance: currentBalance,
                goal_amount: goalAmount,
                future_balance: futureBalance,
                days_until_goal: daysUntilGoal,
                allowance_payments: saturdays.length,
                interest_payments: sundays.length,
                total_allowance: saturdays.length * data.current_allowance,
                message: `✅ Great! Right now you have ${formatCurrency(currentBalance)}.`,
                message2: `You'll reach your goal of ${formatCurrency(goalAmount)} without adding anything extra!`
            });
        } else {
            const shortfall = goalAmount - futureBalance;
            const weeklyExtra = saturdays.length > 0 ? shortfall / saturdays.length : 0;
            
            res.json({
                success: true,
                will_reach: false,
                current_balance: currentBalance,
                goal_amount: goalAmount,
                future_balance: futureBalance,
                shortfall: shortfall,
                days_until_goal: daysUntilGoal,
                allowance_payments: saturdays.length,
                interest_payments: sundays.length,
                weekly_extra_needed: weeklyExtra,
                total_allowance: saturdays.length * data.current_allowance,
                message: `Right now you have ${formatCurrency(currentBalance)}. If you don't add any extra, you'll have ${formatCurrency(futureBalance)} by your target date.`,
                message2: `To reach your goal of ${formatCurrency(goalAmount)}, you'll need to save an additional ${formatCurrency(weeklyExtra)} each week.`
            });
        }
    } catch (error) {
        console.error('Error calculating savings goal:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Recalculate all deposits (admin endpoint)
app.post('/api/recalculate', (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const data = loadAccountData();
        recalculateAllDeposits(data);
        res.json({ success: true, message: 'All deposits recalculated successfully' });
    } catch (error) {
        console.error('Error recalculating deposits:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, (err) => {
    if (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
    console.log(`Bank app server running on http://${HOST}:${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Try opening: http://localhost:${PORT}`);
    }
}).on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Try a different port.`);
    }
});