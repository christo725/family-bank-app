// Family Bank App - Frontend JavaScript

let accountData = {};
let balanceChart = null;
let isAuthenticated = false;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initializing...');
    
    try {
        initializeDateInputs();
        checkAuthStatus();
        loadAccountData();
        setInterval(loadAccountData, 30000); // Refresh every 30 seconds
        setInterval(updateCurrentTime, 1000); // Update time every second
        
        // Check if logo exists and show it
        const logoImg = document.getElementById('logoImage');
        if (logoImg) {
            logoImg.onload = function() {
                document.getElementById('logoContainer').style.display = 'block';
            };
            logoImg.onerror = function() {
                document.getElementById('logoContainer').style.display = 'none';
            };
        }
        
        console.log('App initialized successfully!');
    } catch (error) {
        console.error('Error initializing app:', error);
        document.body.innerHTML = '<div class="container mt-5"><h1>Loading Error</h1><p>Error: ' + error.message + '</p></div>';
    }
});

// Initialize date inputs with appropriate defaults
function initializeDateInputs() {
    const today = new Date();
    const goalDateDefault = new Date();
    goalDateDefault.setDate(today.getDate() + 90);
    
    document.getElementById('goalDate').value = formatDateForInput(goalDateDefault);
    document.getElementById('transactionDate').value = formatDateForInput(today);
}

// Format date for HTML date input
function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

// Format date for display
function formatDateForDisplay(dateString) {
    // Handle both ISO and YYYY-MM-DD formats
    let date;
    if (dateString.includes('T')) {
        date = new Date(dateString);
    } else {
        const [year, month, day] = dateString.split('-').map(num => parseInt(num));
        date = new Date(year, month - 1, day);
    }
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Update current time display
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        const data = await response.json();
        isAuthenticated = data.authenticated;
        updateAuthUI();
    } catch (error) {
        console.error('Error checking auth status:', error);
        isAuthenticated = false;
        updateAuthUI();
    }
}

// Update authentication UI
function updateAuthUI() {
    const loginSection = document.getElementById('loginSection');
    const settingsSection = document.getElementById('settingsSection');
    
    if (isAuthenticated) {
        loginSection.style.display = 'none';
        settingsSection.style.display = 'block';
    } else {
        loginSection.style.display = 'block';
        settingsSection.style.display = 'none';
    }
}

// Login function
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const messageDiv = document.getElementById('loginMessage');
    
    if (!username || !password) {
        showMessage(messageDiv, 'Please enter both username and password', 'danger');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            isAuthenticated = true;
            updateAuthUI();
            loadAccountData(); // Refresh data after login
            showMessage(messageDiv, 'Login successful!', 'success');
            // Clear form
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
        } else {
            showMessage(messageDiv, 'Invalid credentials', 'danger');
        }
    } catch (error) {
        console.error('Error logging in:', error);
        showMessage(messageDiv, 'Login failed. Please try again.', 'danger');
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/auth/logout', { 
            method: 'POST',
            credentials: 'include'
        });
        isAuthenticated = false;
        updateAuthUI();
        loadAccountData(); // Refresh data after logout
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Load account data
async function loadAccountData() {
    console.log('Loading account data...');
    try {
        const response = await fetch('/api/account', {
            credentials: 'include'
        });
        accountData = await response.json();
        
        console.log('Account data loaded successfully. Transaction count:', accountData.transactions?.length || 0);
        console.log('Manual transactions:', accountData.transactions?.filter(t => t.isManual).length || 0);
        
        updateUI();
        updateSettingsForm();
    } catch (error) {
        console.error('Error loading account data:', error);
    }
}

// Update main UI with account data
function updateUI() {
    // Update account title
    document.getElementById('accountTitle').textContent = `${accountData.account_holder}'s Bank Account`;
    
    // Update current balance with animation
    const balanceElement = document.getElementById('currentBalance');
    const newBalance = formatCurrency(accountData.current_balance);
    if (balanceElement.textContent !== newBalance) {
        balanceElement.classList.add('balance-updated');
        setTimeout(() => balanceElement.classList.remove('balance-updated'), 600);
    }
    balanceElement.textContent = newBalance;
    
    // Update next deposit info
    updateNextDepositInfo();
    
    // Update transaction history and chart
    updateTransactionHistory();
    updateBalanceChart();
    
    // Update current rates
    document.getElementById('currentAllowance').textContent = formatCurrency(accountData.current_allowance);
    document.getElementById('currentInterest').textContent = `${accountData.current_interest}%`;
    
    // Update transaction history
    updateTransactionHistory();
    
    // Update balance chart
    updateBalanceChart();
}

// Update next deposit information
function updateNextDepositInfo() {
    const titleElement = document.getElementById('nextDepositTitle');
    const dateElement = document.getElementById('nextDepositDate');
    const daysElement = document.getElementById('nextDepositDays');
    
    if (accountData.is_saturday) {
        titleElement.textContent = '🎉 Today is allowance day!';
        titleElement.className = 'text-success';
        dateElement.textContent = '';
        daysElement.textContent = '';
    } else if (accountData.is_sunday) {
        titleElement.textContent = '💰 Today is interest day!';
        titleElement.className = 'text-primary';
        dateElement.textContent = '';
        daysElement.textContent = '';
    } else {
        // Determine which comes next
        if (accountData.days_until_saturday < accountData.days_until_sunday) {
            titleElement.textContent = 'Next Deposit: Allowance';
            dateElement.textContent = formatDateForDisplay(accountData.next_saturday);
            const days = accountData.days_until_saturday;
            daysElement.textContent = `(${days} day${days !== 1 ? 's' : ''} away)`;
        } else {
            titleElement.textContent = 'Next Deposit: Interest';
            dateElement.textContent = formatDateForDisplay(accountData.next_sunday);
            const days = accountData.days_until_sunday;
            daysElement.textContent = `(${days} day${days !== 1 ? 's' : ''} away)`;
        }
        titleElement.className = '';
    }
}

// Update transaction history table
function updateTransactionHistory() {
    const tbody = document.getElementById('transactionTableBody');
    const noTransactionsMsg = document.getElementById('noTransactionsMessage');
    const table = document.getElementById('transactionTable');
    
    tbody.innerHTML = '';
    
    if (accountData.transactions && accountData.transactions.length > 0) {
        accountData.transactions.forEach(txn => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${formatDateForDisplay(txn.Date)}</td>
                <td>${txn.Type}</td>
                <td class="${txn.Amount >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(txn.Amount)}</td>
                <td class="fw-bold">${formatCurrency(txn.Balance)}</td>
            `;
        });
        table.style.display = 'table';
        noTransactionsMsg.style.display = 'none';
    } else {
        table.style.display = 'none';
        noTransactionsMsg.style.display = 'block';
    }
}

// Update settings transaction management table
function updateSettingsTransactionTable() {
    if (!isAuthenticated || !accountData) return;
    
    const tbody = document.getElementById('settingsTransactionTableBody');
    const noTransactionsMsg = document.getElementById('noManualTransactionsMessage');
    const table = document.getElementById('settingsTransactionTable');
    
    tbody.innerHTML = '';
    
    // Filter only manual transactions
    const manualTransactions = accountData.transactions ? accountData.transactions.filter(txn => txn.isManual) : [];
    
    console.log('Updating settings transaction table. Manual transactions:', manualTransactions.length);
    console.log('Manual transactions details:', manualTransactions.map(t => ({ type: t.Type, amount: t.Amount, manualIndex: t.manualIndex })));
    
    if (manualTransactions.length > 0) {
        manualTransactions.forEach(txn => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${formatDateForDisplay(txn.Date)}</td>
                <td>${txn.Type}</td>
                <td class="${txn.Amount >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(txn.Amount)}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction(${txn.manualIndex})" title="Delete transaction"><i class="fas fa-trash"></i></button></td>
            `;
        });
        table.style.display = 'table';
        noTransactionsMsg.style.display = 'none';
    } else {
        table.style.display = 'none';
        noTransactionsMsg.style.display = 'block';
    }
}

// Update balance chart
function updateBalanceChart() {
    const canvas = document.getElementById('balanceChart');
    const noDataMsg = document.getElementById('noDataMessage');
    
    if (accountData.transactions && accountData.transactions.length > 0) {
        canvas.style.display = 'block';
        noDataMsg.style.display = 'none';
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (balanceChart) {
            balanceChart.destroy();
        }
        
        // Prepare data
        const labels = accountData.transactions.map(txn => 
            new Date(txn.Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        );
        const balances = accountData.transactions.map(txn => txn.Balance);
        
        balanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Balance',
                    data: balances,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#007bff',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        },
                        grid: {
                            color: 'rgba(0, 123, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 123, 255, 0.1)'
                        }
                    }
                },
                elements: {
                    point: {
                        hoverBackgroundColor: '#0056b3'
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    } else {
        canvas.style.display = 'none';
        noDataMsg.style.display = 'block';
    }
}

// Update settings form with current data
function updateSettingsForm() {
    if (!isAuthenticated || !accountData) return;
    
    document.getElementById('accountHolder').value = accountData.account_holder || '';
    document.getElementById('startDate').value = accountData.start_date || '';
    document.getElementById('initialBalance').value = accountData.initial_balance || 0;
    document.getElementById('initialAllowance').value = accountData.initial_allowance || 0;
    document.getElementById('initialInterest').value = accountData.initial_interest || 0;
    document.getElementById('currentAllowanceInput').value = accountData.current_allowance || 0;
    document.getElementById('currentInterestInput').value = accountData.current_interest || 0;
    
    // Update transaction management table
    updateSettingsTransactionTable();
}

// Update initial settings
async function updateInitialSettings() {
    console.log('Update initial settings called, authenticated:', isAuthenticated);
    
    if (!isAuthenticated) {
        showAlert('You must be logged in to update settings', 'warning');
        return;
    }
    
    const data = {
        account_holder: document.getElementById('accountHolder').value,
        initial_balance: document.getElementById('initialBalance').value,
        start_date: document.getElementById('startDate').value,
        initial_allowance: document.getElementById('initialAllowance').value,
        initial_interest: document.getElementById('initialInterest').value
    };
    
    console.log('Initial settings form values collected:', data);
    console.log('About to send fetch request to /api/settings/initial');
    
    try {
        const response = await fetch('/api/settings/initial', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const responseText = await response.text();
        console.log('Initial settings server response:', response.status, responseText);
        
        if (response.ok) {
            showAlert('Initial settings updated successfully! History has been recalculated.', 'success');
            await loadAccountData(); // Reload data
        } else {
            console.error('Initial settings server error:', response.status, responseText);
            showAlert(`Error updating initial settings: ${responseText}`, 'danger');
        }
    } catch (error) {
        console.error('Error updating initial settings:', error);
        showAlert('Error updating initial settings', 'danger');
    }
}

// Update current settings
async function updateCurrentSettings() {
    console.log('Update current settings called, authenticated:', isAuthenticated);
    
    if (!isAuthenticated) {
        showAlert('You must be logged in to update settings', 'warning');
        return;
    }
    
    const data = {
        current_allowance: document.getElementById('currentAllowanceInput').value,
        current_interest: document.getElementById('currentInterestInput').value
    };
    
    console.log('Updating current settings:', data);
    
    try {
        const response = await fetch('/api/settings/current', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const responseText = await response.text();
        console.log('Server response:', response.status, responseText);
        
        if (response.ok) {
            showAlert('Current rates updated successfully!', 'success');
            await loadAccountData(); // Reload data
        } else {
            console.error('Server error:', response.status, responseText);
            showAlert(`Error updating current rates: ${responseText}`, 'danger');
        }
    } catch (error) {
        console.error('Error updating current settings:', error);
        showAlert('Error updating current rates', 'danger');
    }
}

// Add manual transaction
async function addTransaction() {
    if (!isAuthenticated) return;
    
    const type = document.getElementById('transactionType').value;
    const name = document.getElementById('transactionName').value;
    const amount = document.getElementById('transactionAmount').value;
    const date = document.getElementById('transactionDate').value;
    
    if (!name || !amount || amount <= 0 || !date) {
        showAlert('Please enter a valid transaction name, amount, and date', 'warning');
        return;
    }
    
    const data = { type, name, amount, date };
    
    try {
        const response = await fetch('/api/transaction', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showAlert(`${type} of ${formatCurrency(amount)} added successfully!`, 'success');
            // Clear form
            document.getElementById('transactionName').value = '';
            document.getElementById('transactionAmount').value = '';
            document.getElementById('transactionDate').value = formatDateForInput(new Date());
            await loadAccountData(); // Reload data
        } else {
            showAlert('Error adding transaction', 'danger');
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
        showAlert('Error adding transaction', 'danger');
    }
}

// Delete manual transaction
async function deleteTransaction(manualIndex) {
    console.log('Delete transaction called with manualIndex:', manualIndex);
    
    if (!isAuthenticated) return;
    
    if (!confirm('Are you sure you want to delete this transaction? This will recalculate all subsequent balances and interest payments.')) {
        return;
    }
    
    try {
        console.log('Sending DELETE request to:', `/api/transaction/${manualIndex}`);
        const response = await fetch(`/api/transaction/${manualIndex}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        console.log('Delete response status:', response.status);
        
        if (response.ok) {
            showAlert('Transaction deleted successfully!', 'success');
            console.log('About to reload account data after delete...');
            await loadAccountData(); // Reload data
            console.log('Account data reloaded after delete');
        } else {
            showAlert('Error deleting transaction', 'danger');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showAlert('Error deleting transaction', 'danger');
    }
}

// Calculate savings goal
async function calculateSavingsGoal() {
    const goalAmount = document.getElementById('goalAmount').value;
    const goalDate = document.getElementById('goalDate').value;
    const resultsDiv = document.getElementById('goalResults');
    
    if (!goalAmount || !goalDate || goalAmount <= 0) {
        showMessage(resultsDiv, 'Please enter a valid goal amount and date', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/calculate-goal', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                goal_amount: goalAmount,
                goal_date: goalDate
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            let resultHTML = '';
            
            if (data.already_reached) {
                resultHTML = `
                    <div class="alert alert-success">
                        <h5>${data.message}</h5>
                        <p class="mb-0">${data.message2}</p>
                        <div class="mt-3">
                            <button class="btn btn-primary btn-sm me-2" onclick="calculateSavingsGoal()">
                                <i class="fas fa-sync"></i> Try Again
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="resetSavingsGoal()">
                                <i class="fas fa-redo"></i> New Goal
                            </button>
                        </div>
                    </div>
                `;
            } else if (data.will_reach) {
                resultHTML = `
                    <div class="alert alert-success">
                        <h5>${data.message}</h5>
                        <p>${data.message2}</p>
                        <hr>
                        <small class="text-muted">
                            You'll get ${data.allowance_payments} more allowances and ${data.interest_payments} interest payments.
                        </small>
                        <div class="mt-3">
                            <button class="btn btn-primary btn-sm me-2" onclick="calculateSavingsGoal()">
                                <i class="fas fa-sync"></i> Try Again
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="resetSavingsGoal()">
                                <i class="fas fa-redo"></i> New Goal
                            </button>
                        </div>
                    </div>
                `;
            } else {
                resultHTML = `
                    <div class="alert alert-warning">
                        <h5>${data.message}</h5>
                        <p class="mb-3">${data.message2}</p>
                        <div class="mt-3">
                            <button class="btn btn-primary btn-sm me-2" onclick="calculateSavingsGoal()">
                                <i class="fas fa-sync"></i> Try Again
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="resetSavingsGoal()">
                                <i class="fas fa-redo"></i> New Goal
                            </button>
                        </div>
                    </div>
                `;
            }
            
            resultsDiv.innerHTML = resultHTML;
        } else {
            showMessage(resultsDiv, data.message || 'Error calculating savings goal', 'danger');
        }
    } catch (error) {
        console.error('Error calculating savings goal:', error);
        showMessage(resultsDiv, 'Error calculating savings goal', 'danger');
    }
}

// Reset savings goal calculator
function resetSavingsGoal() {
    const today = new Date();
    const goalDateDefault = new Date();
    goalDateDefault.setDate(today.getDate() + 90);
    
    document.getElementById('goalAmount').value = '100';
    document.getElementById('goalDate').value = formatDateForInput(goalDateDefault);
    document.getElementById('goalResults').innerHTML = '';
}

// Show alert message
function showAlert(message, type) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at top of container
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Show message in specific element
function showMessage(element, message, type) {
    element.innerHTML = `<div class="alert alert-${type} mb-0">${message}</div>`;
    
    // Clear message after 5 seconds
    setTimeout(() => {
        element.innerHTML = '';
    }, 5000);
}