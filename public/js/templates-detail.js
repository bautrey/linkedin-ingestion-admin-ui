/**
 * Template Detail JavaScript
 * Handles template detail page functionality
 */

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Template Detail: Page initialized');
    highlightTemplateVariables();
});

// Highlight template variables in the prompt text
function highlightTemplateVariables() {
    const promptTextElement = document.getElementById('promptText');
    if (!promptTextElement) return;
    
    let promptText = promptTextElement.textContent;
    
    // Highlight template variables
    const variablePattern = /\{\{([^}]+)\}\}/g;
    promptText = promptText.replace(variablePattern, '<span class="text-primary fw-bold">${{$1}}</span>');
    
    promptTextElement.innerHTML = promptText;
}

// Copy prompt to clipboard
async function copyPrompt() {
    const promptText = document.getElementById('promptText').textContent;
    
    try {
        await navigator.clipboard.writeText(promptText);
        showNotification('Prompt copied to clipboard', 'success');
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = promptText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Prompt copied to clipboard', 'success');
    }
}

// Test template
async function testTemplate(templateId) {
    showNotification('Template testing feature coming soon', 'info');
    // TODO: Implement template testing with sample profile data
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
    const confirmMessage = `Are you sure you want to delete "${templateName}"? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Double confirmation for destructive action
    const doubleConfirm = prompt('To confirm deletion, please type "DELETE" in all caps:');
    if (doubleConfirm !== 'DELETE') {
        showNotification('Deletion cancelled - confirmation text did not match', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Template deleted successfully', 'success');
            setTimeout(() => {
                window.location.href = '/templates';
            }, 1000);
        } else {
            throw new Error('Failed to delete template');
        }
    } catch (error) {
        showNotification('Error deleting template', 'error');
        console.error('Error deleting template:', error);
    }
}

// View usage history
async function viewUsageHistory(templateId) {
    showNotification('Usage history feature coming soon', 'info');
    // TODO: Implement usage history modal or page
}

// View performance metrics
async function viewPerformanceMetrics(templateId) {
    showNotification('Performance metrics feature coming soon', 'info');
    // TODO: Implement performance metrics dashboard
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
