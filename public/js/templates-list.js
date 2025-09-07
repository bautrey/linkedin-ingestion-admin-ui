/**
 * Template Management JavaScript
 * Handles sorting, filtering, searching, and CRUD operations for templates
 */

// Global state
let allTemplates = [];
let currentSort = { column: 'name', direction: 'asc' };
let currentFilters = { category: '', status: 'active', search: '' };

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Templates List: Page initialized');
    loadTemplatesData();
    initializeSortingHandlers();
});

// Load templates data from the table
function loadTemplatesData() {
    const rows = document.querySelectorAll('#templatesTableBody tr[data-template-id]');
    allTemplates = Array.from(rows).map(row => ({
        id: row.dataset.templateId,
        category: row.dataset.category,
        status: row.dataset.status,
        name: row.cells[0].textContent.trim(),
        description: row.cells[2].textContent.trim(),
        version: row.cells[3].textContent.trim(),
        created_at: row.cells[4].textContent.trim(),
        element: row
    }));
    console.log(`📊 Loaded ${allTemplates.length} templates`);
}

// Initialize table sorting handlers
function initializeSortingHandlers() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            sortTable(column);
        });
        header.style.cursor = 'pointer';
    });
}

// Sort table by column
function sortTable(column) {
    // Toggle sort direction if same column
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    // Update visual indicators
    updateSortIndicators();
    
    // Sort templates array
    allTemplates.sort((a, b) => {
        let aVal = getSortValue(a, column);
        let bVal = getSortValue(b, column);
        
        if (currentSort.direction === 'desc') {
            [aVal, bVal] = [bVal, aVal];
        }
        
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    });
    
    // Re-render table
    renderFilteredTemplates();
}

// Get sortable value for a column
function getSortValue(template, column) {
    switch (column) {
        case 'name':
            return template.name.toLowerCase();
        case 'category':
            return template.category.toLowerCase();
        case 'version':
            return parseFloat(template.version) || 0;
        case 'created_at':
            return new Date(template.created_at);
        case 'is_active':
            return template.status === 'active' ? 1 : 0;
        default:
            return '';
    }
}

// Update sort indicators in table headers
function updateSortIndicators() {
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.className = 'bi bi-arrow-down-up';
    });
    
    const activeHeader = document.querySelector(`[data-column="${currentSort.column}"] i`);
    if (activeHeader) {
        activeHeader.className = currentSort.direction === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down';
    }
}

// Filter templates based on current filters
function filterTemplates() {
    currentFilters.category = document.getElementById('categoryFilter').value;
    currentFilters.status = document.getElementById('statusFilter').value;
    currentFilters.search = document.getElementById('searchInput').value.toLowerCase();
    
    renderFilteredTemplates();
}

// Search templates
function searchTemplates() {
    currentFilters.search = document.getElementById('searchInput').value.toLowerCase();
    renderFilteredTemplates();
}

// Render filtered templates
function renderFilteredTemplates() {
    const tbody = document.getElementById('templatesTableBody');
    
    // Filter templates
    const filteredTemplates = allTemplates.filter(template => {
        // Category filter
        if (currentFilters.category && template.category !== currentFilters.category) {
            return false;
        }
        
        // Status filter
        if (currentFilters.status !== 'all' && template.status !== currentFilters.status) {
            return false;
        }
        
        // Search filter
        if (currentFilters.search) {
            const searchText = (template.name + ' ' + template.description).toLowerCase();
            if (!searchText.includes(currentFilters.search)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Clear table
    tbody.innerHTML = '';
    
    if (filteredTemplates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="bi bi-search fs-1 d-block mb-3"></i>
                    <h5>No templates match your criteria</h5>
                    <p>Try adjusting your filters or search terms.</p>
                    <button class="btn btn-outline-primary" onclick="clearFilters()">Clear Filters</button>
                </td>
            </tr>
        `;
        return;
    }
    
    // Add filtered templates to table
    filteredTemplates.forEach(template => {
        tbody.appendChild(template.element);
    });
    
    console.log(`🔍 Filtered to ${filteredTemplates.length} templates`);
}

// Clear all filters
function clearFilters() {
    document.getElementById('categoryFilter').value = '';
    document.getElementById('statusFilter').value = 'active';
    document.getElementById('searchInput').value = '';
    
    currentFilters = { category: '', status: 'active', search: '' };
    renderFilteredTemplates();
}

// Refresh templates from server
async function refreshTemplates() {
    try {
        window.location.reload();
    } catch (error) {
        showNotification('Error refreshing templates', 'error');
        console.error('Error refreshing templates:', error);
    }
}

// Use template for scoring
function useTemplate(templateId, templateName) {
    // Redirect to scoring page with template pre-selected
    window.location.href = `/scoring?template_id=${templateId}`;
}

// Duplicate template
async function duplicateTemplate(templateId) {
    showNotification('Template duplication feature coming soon', 'info');
    // TODO: Implement template duplication functionality
}

// Export template
async function exportTemplate(templateId) {
    showNotification('Template export feature coming soon', 'info');
    // TODO: Implement template export functionality
}

// Activate template
async function activateTemplate(templateId, templateName) {
    if (!confirm(`Are you sure you want to activate "${templateName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: true })
        });
        
        if (response.ok) {
            showNotification('Template activated successfully', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error('Failed to activate template');
        }
    } catch (error) {
        showNotification('Error activating template', 'error');
        console.error('Error activating template:', error);
    }
}

// Deactivate template
async function deactivateTemplate(templateId, templateName) {
    if (!confirm(`Are you sure you want to deactivate "${templateName}"? This will prevent it from being used in new scoring jobs.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: false })
        });
        
        if (response.ok) {
            showNotification('Template deactivated successfully', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error('Failed to deactivate template');
        }
    } catch (error) {
        showNotification('Error deactivating template', 'error');
        console.error('Error deactivating template:', error);
    }
}

// Delete template
async function deleteTemplate(templateId, templateName) {
    if (!confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Template deleted successfully', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error('Failed to delete template');
        }
    } catch (error) {
        showNotification('Error deleting template', 'error');
        console.error('Error deleting template:', error);
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}
