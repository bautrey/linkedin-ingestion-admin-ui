// LinkedIn Ingestion Admin UI - Main JavaScript

// Global socket connection for real-time updates
let socket = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    initializeTooltips();
    initializeTableSorting();
    initializeNotifications();
});

// Socket.IO connection and real-time updates
function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
        showNotification('Connected to real-time updates', 'success');
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        showNotification('Lost connection to server', 'warning');
    });
    
    // Listen for scoring updates
    socket.on('scoring-started', function(data) {
        showNotification(`Scoring started for profile ${data.profile_id}`, 'info');
        updateJobStatus(data.job_id, 'processing');
    });
    
    socket.on('scoring-completed', function(data) {
        showNotification(`Scoring completed for profile ${data.profile_id}`, 'success');
        updateJobStatus(data.job_id, 'completed');
        refreshCurrentPage();
    });
    
    // Listen for ingestion updates
    socket.on('ingestion-started', function(data) {
        showNotification(`Ingestion started for ${data.url}`, 'info');
        updateJobStatus(data.job_id, 'processing');
    });
    
    socket.on('ingestion-completed', function(data) {
        showNotification(`Ingestion completed for ${data.url}`, 'success');
        updateJobStatus(data.job_id, 'completed');
        refreshCurrentPage();
    });
}

// Initialize Bootstrap tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Initialize table sorting functionality
function initializeTableSorting() {
    const sortableHeaders = document.querySelectorAll('th[data-sort]');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const column = this.dataset.sort;
            const currentOrder = this.dataset.order || 'asc';
            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            
            // Update URL with sort parameters
            const url = new URL(window.location);
            url.searchParams.set('sort_by', column);
            url.searchParams.set('sort_order', newOrder);
            window.location.href = url.toString();
        });
        
        // Add sort icons
        const icon = document.createElement('i');
        const currentSort = new URLSearchParams(window.location.search).get('sort_by');
        const currentOrder = new URLSearchParams(window.location.search).get('sort_order');
        
        if (header.dataset.sort === currentSort) {
            icon.className = currentOrder === 'desc' ? 'bi bi-caret-down-fill ms-1' : 'bi bi-caret-up-fill ms-1';
        } else {
            icon.className = 'bi bi-caret-up ms-1 opacity-50';
        }
        
        header.appendChild(icon);
    });
}

// Show notifications
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification alert alert-${type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after duration
    setTimeout(() => {
        const alert = bootstrap.Alert.getOrCreateInstance(notification);
        alert.close();
    }, duration);
}

// Update job status in tables
function updateJobStatus(jobId, status) {
    const statusElement = document.querySelector(`[data-job-id="${jobId}"] .job-status`);
    if (statusElement) {
        statusElement.className = `badge status-${status}`;
        statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
}

// Refresh current page data
function refreshCurrentPage() {
    // Simple page refresh for now - could be enhanced with AJAX updates
    setTimeout(() => {
        window.location.reload();
    }, 2000);
}

// Profile scoring functionality - Removed to avoid conflicts with profiles-list.js
// See profiles-list.js for actual implementation

// Delete profile functionality - Removed to avoid conflicts with profiles-list.js
// See profiles-list.js for actual implementation

// LinkedIn URL ingestion
function ingestLinkedInUrls() {
    const urlsInput = document.getElementById('linkedin-urls');
    if (!urlsInput) return;
    
    const urls = urlsInput.value.split('\n').filter(url => url.trim());
    if (urls.length === 0) {
        showNotification('Please enter at least one LinkedIn URL', 'warning');
        return;
    }
    
    const submitButton = document.querySelector('#ingest-form button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-grow spinner-grow-sm me-1"></span>Ingesting...';
    
    fetch('/api/ingestion', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urls })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const successCount = data.data.filter(result => result.success).length;
            const failCount = data.data.length - successCount;
            
            showNotification(
                `Ingestion started: ${successCount} successful, ${failCount} failed`, 
                successCount > 0 ? 'success' : 'danger'
            );
            
            if (successCount > 0) {
                urlsInput.value = '';
            }
        } else {
            showNotification(data.message || 'Failed to start ingestion', 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Failed to start ingestion', 'danger');
    })
    .finally(() => {
        resetButton(submitButton, 'Start Ingestion');
    });
}

// Template management
function saveTemplate(isEdit = false) {
    const form = document.getElementById('template-form');
    if (!form) return;
    
    const formData = new FormData(form);
    const templateData = {
        name: formData.get('name'),
        content: formData.get('content'),
        description: formData.get('description'),
        category: formData.get('category')
    };
    
    const templateId = form.dataset.templateId;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `/api/templates/${templateId}` : '/api/templates';
    
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-grow spinner-grow-sm me-1"></span>Saving...';
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`Template ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            setTimeout(() => {
                window.location.href = '/templates';
            }, 1500);
        } else {
            showNotification(data.message || `Failed to ${isEdit ? 'update' : 'create'} template`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification(`Failed to ${isEdit ? 'update' : 'create'} template`, 'danger');
    })
    .finally(() => {
        resetButton(submitButton, isEdit ? 'Update Template' : 'Create Template');
    });
}

// Helper function to reset button state
function resetButton(button, originalText) {
    button.disabled = false;
    button.innerHTML = originalText;
}

// Initialize notifications container
function initializeNotifications() {
    // Remove notifications container if it doesn't exist
    if (!document.querySelector('.notifications-container')) {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        document.body.appendChild(container);
    }
}
