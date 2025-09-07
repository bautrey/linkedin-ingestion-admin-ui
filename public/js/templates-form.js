/**
 * Template Form JavaScript
 * Handles template creation and editing forms
 */

let isEdit = false;
let originalFormData = {};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Template Form: Page initialized');
    initializeForm();
    setupEventHandlers();
    updateCharacterCount();
});

// Initialize form based on edit/create mode
function initializeForm() {
    const templateIdField = document.querySelector('input[name="template_id"]');
    isEdit = templateIdField !== null;
    
    if (isEdit) {
        console.log(`✏️ Edit mode: Template ${templateIdField.value}`);
        storeOriginalFormData();
    } else {
        console.log('➕ Create mode: New template');
    }
}

// Store original form data for comparison
function storeOriginalFormData() {
    const form = document.getElementById('templateForm');
    const formData = new FormData(form);
    originalFormData = {};
    
    for (let [key, value] of formData.entries()) {
        originalFormData[key] = value;
    }
}

// Set up event handlers
function setupEventHandlers() {
    const form = document.getElementById('templateForm');
    const promptTextarea = document.getElementById('prompt_text');
    
    // Form submission
    form.addEventListener('submit', handleFormSubmit);
    
    // Character count for prompt
    promptTextarea.addEventListener('input', updateCharacterCount);
    
    // Form change detection
    form.addEventListener('change', markFormAsDirty);
    form.addEventListener('input', markFormAsDirty);
    
    // Warn about unsaved changes
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Auto-save draft (every 30 seconds)
    if (!isEdit) {
        setInterval(autoSaveDraft, 30000);
    }
}

// Update character count for prompt
function updateCharacterCount() {
    const promptText = document.getElementById('prompt_text').value;
    const charCount = document.getElementById('charCount');
    const length = promptText.length;
    
    charCount.textContent = `${length} characters`;
    
    if (length > 4000) {
        charCount.className = 'text-warning';
        charCount.textContent += ' (very long prompt)';
    } else if (length > 2000) {
        charCount.className = 'text-info';
        charCount.textContent += ' (long prompt)';
    } else {
        charCount.className = 'text-muted';
    }
}

// Mark form as dirty (has unsaved changes)
let formIsDirty = false;
function markFormAsDirty() {
    if (!formIsDirty) {
        formIsDirty = true;
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.innerHTML = submitBtn.innerHTML.replace('Create Template', 'Create Template *');
        submitBtn.innerHTML = submitBtn.innerHTML.replace('Update Template', 'Update Template *');
    }
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="spinner-border spinner-border-sm me-1"></i> Saving...';
        
        // Validate form
        if (!validateForm()) {
            return;
        }
        
        // Prepare form data
        const formData = getFormData();
        
        // Submit to API
        const response = await submitTemplate(formData);
        
        if (response.ok) {
            const result = await response.json();
            showNotification(
                isEdit ? 'Template updated successfully' : 'Template created successfully', 
                'success'
            );
            
            formIsDirty = false;
            
            // Redirect - handle different response structures
            setTimeout(() => {
                let templateId;
                if (result.id) {
                    templateId = result.id;
                } else if (result.data && result.data.id) {
                    templateId = result.data.id;
                } else {
                    // Fallback to templates list if no ID found
                    window.location.href = '/templates';
                    return;
                }
                window.location.href = `/templates/${templateId}`;
            }, 1000);
            
        } else {
            let errorMessage = 'Failed to save template';
            try {
                const error = await response.json();
                if (error.detail && error.detail.message) {
                    errorMessage = error.detail.message;
                } else if (error.message) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                }
            } catch (parseError) {
                console.error('Could not parse error response:', parseError);
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification(`Error saving template: ${error.message}`, 'error');
        
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Validate form data
function validateForm() {
    const form = document.getElementById('templateForm');
    const name = document.getElementById('name').value.trim();
    const category = document.getElementById('category').value;
    const promptText = document.getElementById('prompt_text').value.trim();
    
    // Clear previous validation states
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.invalid-feedback').forEach(el => el.remove());
    
    let isValid = true;
    
    // Validate name
    if (!name) {
        showFieldError('name', 'Template name is required');
        isValid = false;
    }
    
    // Validate category
    if (!category) {
        showFieldError('category', 'Category is required');
        isValid = false;
    }
    
    // Validate prompt
    if (!promptText) {
        showFieldError('prompt_text', 'Prompt template is required');
        isValid = false;
    } else {
        // Check for profile_data placeholder
        if (!promptText.includes('{{profile_data}}')) {
            showFieldError('prompt_text', 'Prompt must include {{profile_data}} placeholder');
            isValid = false;
        }
        
        // Check prompt length
        if (promptText.length > 8000) {
            showFieldError('prompt_text', 'Prompt is too long (max 8000 characters)');
            isValid = false;
        }
    }
    
    return isValid;
}

// Show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    field.classList.add('is-invalid');
    
    const feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    feedback.textContent = message;
    field.parentNode.appendChild(feedback);
}

// Get form data
function getFormData() {
    return {
        name: document.getElementById('name').value.trim(),
        category: document.getElementById('category').value,
        description: document.getElementById('description').value.trim(),
        prompt_text: document.getElementById('prompt_text').value.trim(),
        stage: document.getElementById('stage').value,
        version: document.getElementById('version').value.trim() || '1.0',
        is_active: document.getElementById('is_active').checked
    };
}

// Submit template to API
async function submitTemplate(data) {
    const templateId = document.querySelector('input[name="template_id"]')?.value;
    const url = templateId ? `/api/templates/${templateId}` : '/api/templates';
    const method = templateId ? 'PUT' : 'POST';
    
    return fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
}

// Reset form to original state
function resetForm() {
    if (!confirm('Are you sure you want to reset the form? All unsaved changes will be lost.')) {
        return;
    }
    
    const form = document.getElementById('templateForm');
    
    if (isEdit) {
        // Restore original values
        for (let [key, value] of Object.entries(originalFormData)) {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = value === 'on';
                } else {
                    field.value = value;
                }
            }
        }
    } else {
        // Clear all fields for new template
        form.reset();
        document.getElementById('version').value = '1.0';
        document.getElementById('is_active').checked = true;
    }
    
    formIsDirty = false;
    updateCharacterCount();
    showNotification('Form reset successfully', 'info');
}

// Save as draft
async function saveAsDraft() {
    if (isEdit) {
        showNotification('Draft saving not available for existing templates', 'warning');
        return;
    }
    
    try {
        const data = getFormData();
        data.is_active = false; // Drafts are inactive
        
        const response = await submitTemplate(data);
        
        if (response.ok) {
            showNotification('Draft saved successfully', 'success');
            formIsDirty = false;
        } else {
            throw new Error('Failed to save draft');
        }
        
    } catch (error) {
        showNotification('Error saving draft', 'error');
        console.error('Error saving draft:', error);
    }
}

// Auto-save draft
async function autoSaveDraft() {
    if (!formIsDirty || isEdit) {
        return;
    }
    
    const name = document.getElementById('name').value.trim();
    const promptText = document.getElementById('prompt_text').value.trim();
    
    // Only auto-save if we have some content
    if (name && promptText) {
        console.log('🔄 Auto-saving draft...');
        await saveAsDraft();
    }
}

// Preview template
function previewTemplate() {
    const data = getFormData();
    
    // Open preview in modal or new window
    const preview = `
        <h5>Template Preview</h5>
        <p><strong>Name:</strong> ${data.name || 'Untitled Template'}</p>
        <p><strong>Category:</strong> ${data.category || 'Uncategorized'}</p>
        <p><strong>Description:</strong> ${data.description || 'No description'}</p>
        <p><strong>Stage:</strong> ${data.stage || 'General Purpose'}</p>
        <p><strong>Version:</strong> ${data.version}</p>
        <p><strong>Status:</strong> ${data.is_active ? 'Active' : 'Inactive'}</p>
        <hr>
        <p><strong>Prompt Template:</strong></p>
        <pre class="bg-light p-3" style="white-space: pre-wrap; font-size: 12px;">${data.prompt_text}</pre>
    `;
    
    // Show in modal (you'd need to create a modal for this)
    showPreviewModal(preview);
}

// Show preview modal
function showPreviewModal(content) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('previewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.innerHTML = `
            <div class="modal fade" id="previewModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Template Preview</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="previewContent">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('previewContent').innerHTML = content;
    
    // Show modal
    const bootstrapModal = new bootstrap.Modal(document.getElementById('previewModal'));
    bootstrapModal.show();
}

// Test template (for edit mode)
async function testTemplate() {
    if (!isEdit) {
        showNotification('Please save the template first before testing', 'warning');
        return;
    }
    
    const templateId = document.querySelector('input[name="template_id"]')?.value;
    if (!templateId) {
        showNotification('Template ID not found', 'error');
        return;
    }
    
    try {
        showNotification('Testing template with sample data...', 'info');
        
        // Call the API to test the template with sample profile data
        const response = await fetch(`/api/templates/${templateId}/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                use_sample_data: true
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Show test results in a modal
            const testResults = `
                <h5>Template Test Results</h5>
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> Template test completed successfully
                </div>
                <h6>Sample Profile Data Used:</h6>
                <pre class="bg-light p-3 mb-3" style="font-size: 12px; max-height: 200px; overflow-y: auto;">${JSON.stringify(result.sample_data, null, 2)}</pre>
                <h6>Generated Prompt:</h6>
                <pre class="bg-light p-3 mb-3" style="font-size: 12px; max-height: 300px; overflow-y: auto;">${result.generated_prompt || 'No prompt generated'}</pre>
                <h6>AI Response:</h6>
                <div class="border p-3" style="max-height: 300px; overflow-y: auto;">${result.ai_response || 'No response generated'}</div>
                ${result.score ? `<h6 class="mt-3">Score: <span class="badge bg-primary">${result.score}</span></h6>` : ''}
            `;
            
            showPreviewModal(testResults);
            showNotification('Template test completed successfully', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Template test failed');
        }
        
    } catch (error) {
        console.error('Error testing template:', error);
        showNotification(`Template test failed: ${error.message}`, 'error');
    }
}

// Preview changes (for edit mode)
function previewChanges() {
    const currentData = getFormData();
    
    let changes = [];
    for (let [key, value] of Object.entries(currentData)) {
        if (originalFormData[key] !== value) {
            changes.push(`<li><strong>${key}:</strong> "${originalFormData[key]}" → "${value}"</li>`);
        }
    }
    
    if (changes.length === 0) {
        showNotification('No changes detected', 'info');
        return;
    }
    
    const changesHtml = `
        <h5>Detected Changes</h5>
        <ul>${changes.join('')}</ul>
    `;
    
    showPreviewModal(changesHtml);
}

// Handle before unload
function handleBeforeUnload(event) {
    if (formIsDirty) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
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
