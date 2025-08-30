// Profiles List Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize page functionality
    initializeTableSorting();
    initializeBulkSelection();
    initializeFilters();
    initializeColumnResizing();
    initializeBootstrapComponents();
    
    console.log('Profiles list initialized with column resizing');
});

// Initialize Bootstrap components (dropdowns, modals, etc.)
function initializeBootstrapComponents() {
    // Initialize all dropdowns
    const dropdownElementList = document.querySelectorAll('.dropdown-toggle');
    const dropdownList = [...dropdownElementList].map(dropdownToggleEl => {
        return new bootstrap.Dropdown(dropdownToggleEl);
    });
    
    console.log(`Initialized ${dropdownList.length} dropdowns`);
    
    // Initialize modals
    const modalElementList = document.querySelectorAll('.modal');
    const modalList = [...modalElementList].map(modalEl => {
        return new bootstrap.Modal(modalEl);
    });
    
    console.log(`Initialized ${modalList.length} modals`);
}

// Table Sorting Functionality
function initializeTableSorting() {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            // Don't sort if clicking on a resize handle
            if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
                e.preventDefault();
                return;
            }
            
            const sortBy = this.getAttribute('data-sort');
            const currentUrl = new URL(window.location);
            const currentSort = currentUrl.searchParams.get('sort_by');
            const currentOrder = currentUrl.searchParams.get('sort_order');
            
            let newOrder = 'asc';
            if (currentSort === sortBy && currentOrder === 'asc') {
                newOrder = 'desc';
            }
            
            // Update URL parameters
            currentUrl.searchParams.set('sort_by', sortBy);
            currentUrl.searchParams.set('sort_order', newOrder);
            
            
            // Navigate to sorted page
            window.location.href = currentUrl.toString();
        });
        
        // Update sort icons based on current sort
        updateSortIcons();
    });
}

function updateSortIcons() {
    const urlParams = new URLSearchParams(window.location.search);
    const sortBy = urlParams.get('sort_by');
    const sortOrder = urlParams.get('sort_order');
    
    if (sortBy) {
        const activeHeader = document.querySelector(`[data-sort="${sortBy}"]`);
        if (activeHeader) {
            const icon = activeHeader.querySelector('.sort-icon');
            if (sortOrder === 'desc') {
                icon.className = 'bi bi-chevron-down sort-icon';
            } else {
                icon.className = 'bi bi-chevron-up sort-icon';
            }
            activeHeader.classList.add('table-active');
        }
    }
}

// Bulk Selection Functionality
function initializeBulkSelection() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const profileCheckboxes = document.querySelectorAll('.profile-checkbox');
    const bulkActionsBtn = document.getElementById('bulkActionsBtn');
    const selectedCountSpan = document.getElementById('selectedCount');
    const bulkSelectedCountSpan = document.getElementById('bulkSelectedCount');
    
    // Select All functionality
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            profileCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
            updateBulkActionButton();
        });
    }
    
    // Individual checkbox functionality
    profileCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateBulkActionButton();
            updateSelectAllCheckbox();
        });
    });
    
    function updateBulkActionButton() {
        const selectedCheckboxes = document.querySelectorAll('.profile-checkbox:checked');
        const count = selectedCheckboxes.length;
        
        if (selectedCountSpan) selectedCountSpan.textContent = count;
        if (bulkSelectedCountSpan) bulkSelectedCountSpan.textContent = count;
        
        if (bulkActionsBtn) {
            if (count > 0) {
                bulkActionsBtn.disabled = false;
                bulkActionsBtn.classList.remove('btn-outline-primary');
                bulkActionsBtn.classList.add('btn-primary');
            } else {
                bulkActionsBtn.disabled = true;
                bulkActionsBtn.classList.remove('btn-primary');
                bulkActionsBtn.classList.add('btn-outline-primary');
            }
        }
    }
    
    function updateSelectAllCheckbox() {
        if (!selectAllCheckbox) return;
        
        const totalCheckboxes = profileCheckboxes.length;
        const checkedCheckboxes = document.querySelectorAll('.profile-checkbox:checked').length;
        
        if (checkedCheckboxes === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes === totalCheckboxes) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
}

// Filter Management
function initializeFilters() {
    // Auto-submit form when dropdowns change
    const filterSelects = document.querySelectorAll('#filterForm select');
    filterSelects.forEach(select => {
        select.addEventListener('change', function() {
            document.getElementById('filterForm').submit();
        });
    });
    
    // Search with debounce
    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                // Auto-submit after 500ms of no typing
                if (this.value.length >= 3 || this.value.length === 0) {
                    document.getElementById('filterForm').submit();
                }
            }, 500);
        });
    }
}

function clearFilters() {
    const form = document.getElementById('filterForm');
    if (form) {
        form.reset();
        window.location.href = '/profiles';
    }
}

function resetFilters() {
    clearFilters();
}

// Profile Management Actions
function scoreProfile(profileId) {
    // Navigate to scoring interface for this profile
    window.location.href = `/scoring?profile_id=${profileId}`;
}

function deleteProfile(profileId, profileName) {
    console.log('deleteProfile called with:', { profileId, profileName });
    
    // Find the modal and elements
    const modalElement = document.getElementById('deleteConfirmModal');
    const profileNameElement = document.getElementById('deleteProfileName');
    const confirmButton = document.getElementById('confirmDeleteBtn');
    
    if (!modalElement || !profileNameElement || !confirmButton) {
        console.error('Modal elements not found');
        showNotification('Modal not available', 'danger');
        return;
    }
    
    // Update modal content
    profileNameElement.textContent = profileName || 'Unknown Profile';
    
    // Remove all existing event listeners from the confirm button to prevent stacking
    const cleanConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(cleanConfirmButton, confirmButton);
    
    // Create a one-time event handler function
    const handleConfirmDelete = function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('Delete confirmed for profile:', profileId);
        
        // Remove this event listener immediately to prevent multiple calls
        event.target.removeEventListener('click', handleConfirmDelete);
        
        // Close modal immediately
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
        
        // Show loading overlay
        showLoadingOverlay();
        
        // Make the delete request
        fetch(`/profiles/${profileId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            console.log('Delete response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Delete response data:', data);
            hideLoadingOverlay();
            
            if (data.success) {
                showNotification('Profile deleted successfully', 'success');
                // Remove the row from the table
                const row = document.querySelector(`tr[data-profile-id="${profileId}"]`);
                if (row) {
                    row.remove();
                    console.log('Row removed from table');
                }
                // Update counts
                updateProfileCounts();
            } else {
                showNotification('Failed to delete profile: ' + (data.message || 'Unknown error'), 'danger');
            }
        })
        .catch(error => {
            console.error('Error deleting profile:', error);
            hideLoadingOverlay();
            showNotification('An error occurred while deleting the profile', 'danger');
        });
    };
    
    // Add the event listener once
    cleanConfirmButton.addEventListener('click', handleConfirmDelete, { once: true });
    
    // Show the modal using Bootstrap
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    console.log('Modal shown for delete confirmation');
}

// Bulk Actions
function bulkScore() {
    const selectedIds = getSelectedProfileIds();
    if (selectedIds.length === 0) {
        showNotification('Please select profiles to score', 'warning');
        return;
    }
    
    // Navigate to bulk scoring interface
    const idsParam = selectedIds.join(',');
    window.location.href = `/scoring?profile_ids=${idsParam}`;
}


function bulkDelete() {
    const selectedIds = getSelectedProfileIds();
    if (selectedIds.length === 0) {
        showNotification('Please select profiles to delete', 'warning');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected profiles?\n\nThis action cannot be undone.`)) {
        showLoadingOverlay();
        
        const deletePromises = selectedIds.map(id => {
            return fetch(`/profiles/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
        });
        
        Promise.all(deletePromises)
            .then(responses => Promise.all(responses.map(r => r.json())))
            .then(results => {
                hideLoadingOverlay();
                const successCount = results.filter(r => r.success).length;
                const failureCount = results.length - successCount;
                
                if (successCount > 0) {
                    showNotification(`Successfully deleted ${successCount} profiles`, 'success');
                    // Remove successful deletions from table
                    selectedIds.forEach(id => {
                        const row = document.querySelector(`tr[data-profile-id="${id}"]`);
                        if (row) row.remove();
                    });
                    updateProfileCounts();
                }
                
                if (failureCount > 0) {
                    showNotification(`Failed to delete ${failureCount} profiles`, 'warning');
                }
                
                // Close modal and reset selection
                const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
                if (modal) modal.hide();
                resetBulkSelection();
            })
            .catch(error => {
                hideLoadingOverlay();
                console.error('Error deleting profiles:', error);
                showNotification('An error occurred during bulk delete', 'danger');
            });
    }
}

// Utility Functions
function getSelectedProfileIds() {
    const selectedCheckboxes = document.querySelectorAll('.profile-checkbox:checked');
    return Array.from(selectedCheckboxes).map(cb => cb.value);
}

function resetBulkSelection() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const profileCheckboxes = document.querySelectorAll('.profile-checkbox');
    
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    profileCheckboxes.forEach(cb => cb.checked = false);
    
    const bulkActionsBtn = document.getElementById('bulkActionsBtn');
    if (bulkActionsBtn) {
        bulkActionsBtn.disabled = true;
        bulkActionsBtn.classList.remove('btn-primary');
        bulkActionsBtn.classList.add('btn-outline-primary');
    }
    
    const selectedCountSpan = document.getElementById('selectedCount');
    if (selectedCountSpan) selectedCountSpan.textContent = '0';
}

function updateProfileCounts() {
    // Update the header counts
    const remainingRows = document.querySelectorAll('#profilesTable tbody tr[data-profile-id]').length;
    const headerText = document.querySelector('h2').nextElementSibling;
    if (headerText && remainingRows === 0) {
        headerText.textContent = 'No profiles found';
        // Show empty state without auto-reload to prevent infinite delete loops
        const tbody = document.querySelector('#profilesTable tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <div class="text-muted">
                            <i class="bi bi-people" style="font-size: 3rem;"></i>
                            <p class="mt-2">No profiles remaining</p>
                            <a href="/profiles" class="btn btn-primary mt-2">
                                <i class="bi bi-arrow-clockwise"></i> Refresh Page
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

// Column Resizing (Advanced Feature)
function initializeColumnResizing() {
    const table = document.getElementById('profilesTable');
    if (!table) {
        console.log('❌ Table not found!');
        return;
    }

    const resizableColumns = table.querySelectorAll('th.resizable');
    console.log(`🔍 Found ${resizableColumns.length} resizable columns:`, resizableColumns);
    
    resizableColumns.forEach((th, index) => {
        const handle = th.querySelector('.resize-handle');
        console.log(`Column ${index}:`, {
            element: th,
            hasHandle: !!handle,
            dataSort: th.getAttribute('data-sort')
        });
        
        if (!handle) {
            console.log(`❌ No resize handle found for column ${index}`);
            return;
        }
        
        console.log(`✅ Setting up resize handler for column: ${th.getAttribute('data-sort')}`);
        handle.style.cursor = 'col-resize';

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        let currentTh = null;

        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling to sort handler
            isResizing = true;
            currentTh = th;
            startX = e.clientX;
            
            // Use the ACTUAL current width that's displayed, not computed width
            const currentDisplayWidth = th.offsetWidth;
            startWidth = currentDisplayWidth;
            
            // Debug: Log current state
            const beforeWidth = th.style.width;
            const computedWidth = document.defaultView.getComputedStyle(th).width;
            console.log('Before resize:', {
                columnName: th.getAttribute('data-sort'),
                beforeStyleWidth: beforeWidth,
                computedWidth: computedWidth,
                offsetWidth: th.offsetWidth,
                usingWidth: currentDisplayWidth
            });
            
            // Set the ACTUAL displayed width to prevent any jump
            th.style.width = currentDisplayWidth + 'px';
            console.log('Set width to prevent jump:', currentDisplayWidth + 'px');
            
            document.body.classList.add('col-resize-active');
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        function handleMouseMove(e) {
            if (!isResizing) return;
            
            const diff = e.clientX - startX;
            const newWidth = Math.max(startWidth + diff, 80); // Minimum width of 80px
            
            console.log('Mouse move:', {
                startX: startX,
                currentX: e.clientX,
                diff: diff,
                startWidth: startWidth,
                newWidth: newWidth
            });
            
            currentTh.style.width = newWidth + 'px';
            
            // Update corresponding column cells
            updateColumnCells(currentTh, newWidth);
        }

        function handleMouseUp() {
            if (!isResizing) return;
            
            isResizing = false;
            currentTh = null;
            document.body.classList.remove('col-resize-active');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            saveColumnWidths();
        }
    });
    
    // Load saved column widths
    loadColumnWidths();
}

// Update all cells in a column to match header width
function updateColumnCells(th, width) {
    const table = th.closest('table');
    const index = Array.from(th.parentNode.children).indexOf(th);
    
    const cells = table.querySelectorAll(`tbody tr td:nth-child(${index + 1})`);
    cells.forEach(cell => {
        cell.style.width = width + 'px';
    });
}

// Save column widths to localStorage
function saveColumnWidths() {
    const table = document.getElementById('profilesTable');
    if (!table) return;

    const widths = {};
    const headers = table.querySelectorAll('thead th');
    
    headers.forEach((th, index) => {
        const sortAttribute = th.getAttribute('data-sort');
        if (sortAttribute) {
            widths[sortAttribute] = th.style.width || th.offsetWidth + 'px';
        }
    });
    
    localStorage.setItem('profilesTableWidths', JSON.stringify(widths));
    showNotification('Column widths saved', 'success');
}

// Load column widths from localStorage
function loadColumnWidths() {
    const savedWidths = localStorage.getItem('profilesTableWidths');
    if (!savedWidths) {
        // If no saved widths, convert CSS percentages to pixels to prevent jumps
        stabilizeColumnWidths();
        return;
    }

    try {
        const widths = JSON.parse(savedWidths);
        const table = document.getElementById('profilesTable');
        if (!table) return;

        const headers = table.querySelectorAll('thead th');
        headers.forEach(th => {
            const sortAttribute = th.getAttribute('data-sort');
            if (sortAttribute && widths[sortAttribute]) {
                th.style.width = widths[sortAttribute];
                updateColumnCells(th, parseInt(widths[sortAttribute]));
            }
        });
    } catch (error) {
        console.error('Error loading column widths:', error);
        stabilizeColumnWidths();
    }
}

// Stabilize column widths by converting percentages to pixels on initial load
function stabilizeColumnWidths() {
    const table = document.getElementById('profilesTable');
    if (!table) return;
    
    // Wait for layout to settle
    setTimeout(() => {
        const headers = table.querySelectorAll('thead th');
        headers.forEach(th => {
            const computedWidth = document.defaultView.getComputedStyle(th).width;
            th.style.width = computedWidth;
            updateColumnCells(th, parseInt(computedWidth));
        });
    }, 100);
}


// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + A to select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = !selectAllCheckbox.checked;
            selectAllCheckbox.dispatchEvent(new Event('change'));
        }
    }
    
    // Delete key for bulk delete (when items are selected)
    if (e.key === 'Delete' && getSelectedProfileIds().length > 0 && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        bulkDelete();
    }
    
    // Escape to clear selection
    if (e.key === 'Escape') {
        resetBulkSelection();
    }
});

// URL Helper Functions (needed for pagination)
function buildPageUrl(page) {
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    return url.toString();
}

// Auto-refresh functionality for real-time updates
let autoRefreshInterval;

function startAutoRefresh(intervalMs = 30000) {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        // Only refresh if no modals are open and no selections are made
        const openModals = document.querySelectorAll('.modal.show');
        const selectedProfiles = getSelectedProfileIds();
        
        if (openModals.length === 0 && selectedProfiles.length === 0) {
            // Silent refresh - could be implemented with fetch and DOM updates
            // For now, we'll do a full page refresh
            window.location.reload();
        }
    }, intervalMs);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Start auto-refresh when page loads
// startAutoRefresh(60000); // Refresh every minute - commented out for now

// Utility functions for notifications and loading overlay
function showNotification(message, type = 'info') {
    // Simple notification using browser alert for now
    // In a real app, you'd use a proper notification library
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Create a simple toast-like notification
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

function showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}
