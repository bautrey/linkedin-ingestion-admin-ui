// Main application JavaScript for LinkedIn Ingestion Admin UI

// Global variables
let socket;
let connectionStatus = 'connecting';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('LinkedIn Ingestion Admin UI initializing...');
    
    initializeWebSocket();
    initializeTooltips();
    initializeAlerts();
    initializeTheme();
    initializeNavigation();
});

// WebSocket connection management
function initializeWebSocket() {
    try {
        socket = io();
        
        socket.on('connect', function() {
            console.log('Connected to server');
            updateConnectionStatus('connected');
            showToast('Connected', 'Real-time updates are now active', 'success', 3000);
        });
        
        socket.on('disconnect', function() {
            console.log('Disconnected from server');
            updateConnectionStatus('disconnected');
            showToast('Disconnected', 'Lost connection to server', 'warning', 5000);
        });
        
        socket.on('connect_error', function(error) {
            console.error('Connection error:', error);
            updateConnectionStatus('error');
        });
        
        // Listen for profile updates
        socket.on('profile_updated', function(data) {
            console.log('Profile updated:', data);
            showToast('Profile Updated', `Profile "${data.name}" has been updated`, 'info');
            
            // Refresh current page if viewing profiles
            if (window.location.pathname.includes('/profiles')) {
                setTimeout(() => {
                    if (confirm('A profile was updated. Refresh the page to see changes?')) {
                        location.reload();
                    }
                }, 1000);
            }
        });
        
        // Listen for new ingestions
        socket.on('new_ingestion', function(data) {
            console.log('New ingestion:', data);
            showToast('New Profile', `${data.name} has been ingested`, 'success');
            
            // Update dashboard counters if on dashboard
            if (window.location.pathname === '/') {
                updateDashboardCounters();
            }
        });
        
        // Welcome message
        socket.on('connected', function(data) {
            console.log('Server welcome:', data.message);
        });
        
        // Job status initial load
        socket.on('job-status-initial', function(data) {
            console.log('Initial job statuses received:', data);
            updateJobStatusDisplay(data);
        });
        
        // Job status updates
        socket.on('job-status-update', function(data) {
            console.log('Job status update:', data);
            updateJobStatusDisplay([data]); // Single update wrapped in array
            
            // Show toast notification for important events
            const jobName = data.name || 'Job';
            let message = '';
            let type = 'info';
            
            switch(data.status) {
                case 'completed':
                    message = `${jobName} completed successfully`;
                    type = 'success';
                    break;
                case 'failed':
                    message = `${jobName} failed: ${data.error || 'Unknown error'}`;
                    type = 'danger';
                    break;
                case 'started':
                    message = `${jobName} started processing`;
                    type = 'info';
                    break;
                case 'retrying':
                    message = `${jobName} is being retried (Attempt ${data.attempt || '?'})`;
                    type = 'warning';
                    break;
            }
            
            if (message) {
                showToast('Job Update', message, type);
            }
        });
        
    } catch (error) {
        console.error('WebSocket initialization failed:', error);
        updateConnectionStatus('error');
    }
}

// Update connection status indicator
function updateConnectionStatus(status) {
    connectionStatus = status;
    const statusElement = document.getElementById('connectionStatus');
    
    if (!statusElement) return;
    
    const icon = statusElement.querySelector('i');
    if (!icon) return;
    
    // Reset classes
    icon.className = 'bi bi-wifi';
    
    switch (status) {
        case 'connected':
            icon.classList.add('text-success');
            icon.title = 'Connected to server';
            break;
        case 'disconnected':
            icon.classList.add('text-warning');
            icon.title = 'Disconnected from server';
            break;
        case 'connecting':
            icon.classList.add('text-warning');
            icon.title = 'Connecting to server...';
            break;
        case 'error':
            icon.classList.add('text-danger');
            icon.title = 'Connection error';
            break;
        default:
            icon.classList.add('text-secondary');
            icon.title = 'Unknown connection status';
    }
}

// Initialize Bootstrap tooltips
function initializeTooltips() {
    try {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function(tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    } catch (error) {
        console.error('Tooltip initialization failed:', error);
    }
}

// Initialize alert auto-dismiss
function initializeAlerts() {
    try {
        const alerts = document.querySelectorAll('.alert[data-bs-dismiss="alert"]');
        alerts.forEach(alert => {
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                const bsAlert = new bootstrap.Alert(alert);
                if (bsAlert) {
                    bsAlert.close();
                }
            }, 5000);
        });
    } catch (error) {
        console.error('Alert initialization failed:', error);
    }
}

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    showToast('Theme Changed', `Switched to ${newTheme} mode`, 'info', 2000);
}

function updateThemeIcon(theme) {
    // Update theme toggle button icon
    const themeButtons = document.querySelectorAll('[onclick="toggleTheme()"]');
    themeButtons.forEach(button => {
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' 
                ? 'bi bi-sun-fill me-2' 
                : 'bi bi-moon-stars me-2';
        }
        button.innerHTML = button.innerHTML.replace(/(Light|Dark) Mode/, theme === 'dark' ? 'Light Mode' : 'Dark Mode');
    });
}

// Navigation enhancements
function initializeNavigation() {
    // Add active class to current page navigation
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

// Toast notification system
function showToast(title, message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    
    const toastId = 'toast_' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <i class="bi bi-${getToastIcon(type)} me-2 text-${type}"></i>
                <strong class="me-auto">${escapeHtml(title)}</strong>
                <small class="text-muted">just now</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${escapeHtml(message)}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        delay: duration
    });
    
    toast.show();
    
    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1080'; // Above modals
    document.body.appendChild(container);
    return container;
}

// Get appropriate icon for toast type
function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle',
        danger: 'exclamation-circle',
        error: 'exclamation-circle'
    };
    return icons[type] || 'info-circle';
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}

function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown';
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return formatDate(dateString);
}

// API call helper with error handling
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorData}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        showToast('API Error', error.message, 'danger', 8000);
        throw error;
    }
}

// Loading state helpers
function showLoading(element) {
    if (!element) return () => {};
    
    const originalContent = element.innerHTML;
    const originalDisabled = element.disabled;
    
    element.innerHTML = '<i class="loading-spinner me-1"></i> Loading...';
    element.disabled = true;
    
    return function hideLoading() {
        element.innerHTML = originalContent;
        element.disabled = originalDisabled;
    };
}

function showElementLoading(element) {
    if (!element) return;
    
    element.classList.add('skeleton');
    element.style.color = 'transparent';
}

function hideElementLoading(element) {
    if (!element) return;
    
    element.classList.remove('skeleton');
    element.style.color = '';
}

// Confirmation dialog
function confirmAction(message, callback, options = {}) {
    const {
        title = 'Confirm Action',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'warning'
    } = options;
    
    // For now, use simple confirm. Could be enhanced with a custom modal later
    if (confirm(`${title}\n\n${message}`)) {
        callback();
    }
}

// Dashboard specific functions
function updateDashboardCounters() {
    // This would be called when new data comes in via WebSocket
    // Could fetch updated counts and update the dashboard cards
    console.log('Updating dashboard counters...');
}

// Job status display update function
function updateJobStatusDisplay(jobStatuses) {
    if (!Array.isArray(jobStatuses)) {
        console.warn('updateJobStatusDisplay: jobStatuses should be an array');
        return;
    }
    
    console.log('Updating job status display with:', jobStatuses);
    
    jobStatuses.forEach(job => {
        // Try to find existing job status elements by ID
        const jobId = job.id || job.name?.replace(/\s+/g, '-').toLowerCase();
        if (!jobId) return;
        
        // Look for job status elements with data-job-id attribute
        const jobElements = document.querySelectorAll(`[data-job-id="${jobId}"]`);
        
        jobElements.forEach(element => {
            updateJobStatusElement(element, job);
        });
        
        // Also look for generic job status containers
        const jobContainers = document.querySelectorAll('.job-status, .job-item, [data-job-name]');
        jobContainers.forEach(container => {
            const jobName = container.getAttribute('data-job-name');
            if (jobName === job.name || jobName === jobId) {
                updateJobStatusElement(container, job);
            }
        });
        
        // Update any job-specific badges or status indicators
        updateJobBadges(jobId, job);
    });
}

// Update individual job status element
function updateJobStatusElement(element, job) {
    if (!element || !job) return;
    
    // Update status badge
    const statusBadge = element.querySelector('.job-status-badge, .status-badge, .badge');
    if (statusBadge) {
        updateStatusBadge(statusBadge, job.status);
    }
    
    // Update last run time
    const lastRunElement = element.querySelector('.last-run, .job-last-run, [data-job-last-run]');
    if (lastRunElement && job.lastRun) {
        lastRunElement.textContent = formatTimeAgo(job.lastRun);
        lastRunElement.title = formatDateTime(job.lastRun);
    }
    
    // Update next run time
    const nextRunElement = element.querySelector('.next-run, .job-next-run, [data-job-next-run]');
    if (nextRunElement && job.nextRun) {
        nextRunElement.textContent = formatTimeAgo(job.nextRun);
        nextRunElement.title = formatDateTime(job.nextRun);
    }
    
    // Update attempt count
    const attemptElement = element.querySelector('.attempt-count, .job-attempt, [data-job-attempt]');
    if (attemptElement && job.attempt) {
        attemptElement.textContent = job.attempt;
    }
    
    // Update error message
    const errorElement = element.querySelector('.job-error, .error-message, [data-job-error]');
    if (errorElement) {
        if (job.error) {
            errorElement.textContent = job.error;
            errorElement.style.display = 'block';
            errorElement.classList.add('text-danger');
        } else {
            errorElement.style.display = 'none';
        }
    }
    
    // Add visual feedback for status changes
    element.classList.add('job-status-updated');
    setTimeout(() => {
        element.classList.remove('job-status-updated');
    }, 2000);
}

// Update status badge with appropriate styling
function updateStatusBadge(badge, status) {
    if (!badge || !status) return;
    
    // Remove existing status classes
    badge.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-primary', 'bg-secondary', 'bg-info');
    
    // Set new status and styling
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    
    switch (status.toLowerCase()) {
        case 'completed':
        case 'success':
            badge.classList.add('bg-success');
            break;
        case 'failed':
        case 'error':
            badge.classList.add('bg-danger');
            break;
        case 'running':
        case 'started':
        case 'processing':
            badge.classList.add('bg-primary');
            break;
        case 'retrying':
        case 'retry':
            badge.classList.add('bg-warning');
            break;
        case 'pending':
        case 'waiting':
            badge.classList.add('bg-secondary');
            break;
        case 'scheduled':
            badge.classList.add('bg-info');
            break;
        default:
            badge.classList.add('bg-secondary');
    }
}

// Update job badges across the UI
function updateJobBadges(jobId, job) {
    if (!jobId || !job) return;
    
    // Look for badges with specific job IDs in various locations
    const selectors = [
        `#${jobId}-status`,
        `#job-${jobId}-status`,
        `.job-${jobId} .status-badge`,
        `[data-status-for="${jobId}"]`
    ];
    
    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                updateStatusBadge(element, job.status);
            });
        } catch (error) {
            // Invalid selector, skip
        }
    });
}

// Search debouncing
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

// Export functions for other scripts to use
window.adminUI = {
    showToast,
    showLoading,
    hideElementLoading,
    showElementLoading,
    confirmAction,
    apiCall,
    formatDate,
    formatDateTime,
    formatTimeAgo,
    debounce,
    escapeHtml
};

console.log('LinkedIn Ingestion Admin UI loaded successfully');
