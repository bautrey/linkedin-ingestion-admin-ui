// Step-Specific Progress Indicators Tests
// Testing enhanced status messages and progress display

// Mock DOM elements for testing
class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.className = '';
        this.textContent = '';
        this.innerHTML = '';
        this.style = {};
        this.children = [];
        this.attributes = {};
    }

    querySelector(selector) {
        // Simple mock implementation
        if (selector === '.progress-bar') return this.progressBar || null;
        if (selector === '.step-progress') return this.stepProgress || null;
        if (selector === '.step-details') return this.stepDetails || null;
        if (selector === '.step-status') return this.stepStatus || null;
        if (selector === '.step-eta') return this.stepEta || null;
        return null;
    }

    appendChild(child) {
        this.children.push(child);
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }
}

// Mock document.getElementById
global.document = {
    getElementById: (id) => {
        const element = new MockElement('div');
        element.id = id;
        
        // Set up step-specific mock structure
        if (id.startsWith('step-')) {
            element.stepProgress = new MockElement('div');
            element.stepDetails = new MockElement('div');
            element.stepStatus = new MockElement('div');
            element.stepEta = new MockElement('div');
            element.progressBar = new MockElement('div');
            element.progressBar.style = {};
        }
        
        return element;
    },
    createElement: (tagName) => new MockElement(tagName),
    querySelectorAll: () => []
};

// Enhanced progress indicator functions
function createStepProgressBar(stepId, initialProgress = 0) {
    const stepElement = document.getElementById(stepId);
    if (!stepElement) return null;
    
    let progressContainer = stepElement.querySelector('.step-progress');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'step-progress mt-2';
        progressContainer.innerHTML = `
            <div class="progress" style="height: 4px;">
                <div class="progress-bar bg-primary" role="progressbar" 
                     style="width: ${initialProgress}%" 
                     aria-valuenow="${initialProgress}" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                </div>
            </div>
            <div class="step-eta small text-muted mt-1"></div>
        `;
        
        // Insert after step-status
        const statusEl = stepElement.querySelector('.step-status');
        if (statusEl && statusEl.parentNode) {
            statusEl.parentNode.appendChild(progressContainer);
        }
    }
    
    return progressContainer;
}

function updateStepProgress(stepId, progress, details = null, eta = null) {
    const stepElement = document.getElementById(stepId);
    if (!stepElement) return;
    
    // Update progress bar
    const progressBar = stepElement.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
        progressBar.setAttribute('aria-valuenow', progress.toString());
    }
    
    // Update details
    if (details) {
        let detailsEl = stepElement.querySelector('.step-details');
        if (!detailsEl) {
            detailsEl = document.createElement('div');
            detailsEl.className = 'step-details small text-muted mt-1';
            stepElement.appendChild(detailsEl);
        }
        detailsEl.textContent = details;
    }
    
    // Update ETA
    if (eta) {
        const etaEl = stepElement.querySelector('.step-eta');
        if (etaEl) {
            etaEl.textContent = eta;
        }
    }
}

function showIntermediateResult(stepId, result, type = 'info') {
    const stepElement = document.getElementById(stepId);
    if (!stepElement) return;
    
    let intermediateEl = stepElement.querySelector('.intermediate-results');
    if (!intermediateEl) {
        intermediateEl = document.createElement('div');
        intermediateEl.className = 'intermediate-results mt-2';
        stepElement.appendChild(intermediateEl);
    }
    
    const resultEl = document.createElement('div');
    resultEl.className = `intermediate-result p-2 mb-1 rounded-2 bg-light border-start border-${type === 'error' ? 'danger' : 'primary'} border-3`;
    resultEl.innerHTML = `
        <div class="d-flex align-items-start">
            <i class="bi bi-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} text-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} me-2 mt-1"></i>
            <div class="flex-grow-1">
                <div class="small">${result}</div>
                <div class="text-muted small">${new Date().toLocaleTimeString()}</div>
            </div>
        </div>
    `;
    
    intermediateEl.appendChild(resultEl);
    
    // Limit to last 5 intermediate results
    while (intermediateEl.children.length > 5) {
        intermediateEl.removeChild(intermediateEl.firstChild);
    }
}

function updateVerificationProgress(data, progress) {
    updateStepProgress('step-verify', progress);
    
    if (data.context?.result?.linkedin_url) {
        showIntermediateResult('step-verify', `Testing access to: ${data.context.result.linkedin_url}`);
    }
    
    if (progress >= 50 && data.context?.result?.status) {
        showIntermediateResult('step-verify', `Response: ${data.context.result.status}`);
    }
    
    if (progress >= 80 && data.context?.result?.profile_accessible !== undefined) {
        const accessible = data.context.result.profile_accessible;
        showIntermediateResult('step-verify', 
            accessible ? 'Profile is accessible' : 'Profile access restricted', 
            accessible ? 'success' : 'error'
        );
    }
}

function updateIngestionProgress(data, progress) {
    updateStepProgress('step-ingest', progress, null, progress < 100 ? 'Extracting data...' : null);
    
    if (progress >= 20 && data.context?.result?.profile_name) {
        showIntermediateResult('step-ingest', `Found profile: ${data.context.result.profile_name}`);
    }
    
    if (progress >= 40 && data.context?.result?.current_title) {
        showIntermediateResult('step-ingest', `Current role: ${data.context.result.current_title}`);
    }
    
    if (progress >= 60 && data.context?.result?.current_company) {
        showIntermediateResult('step-ingest', `Company: ${data.context.result.current_company}`);
    }
    
    if (progress >= 80 && data.context?.result?.years_experience) {
        showIntermediateResult('step-ingest', `Experience: ${data.context.result.years_experience} years`);
    }
}

function updateCompatibilityProgress(data, progress) {
    const roles = ['CIO', 'CTO', 'CISO'];
    const currentRole = Math.floor((progress / 100) * roles.length);
    
    if (currentRole < roles.length) {
        updateStepProgress('step-compatibility', progress, `Analyzing ${roles[currentRole]} compatibility...`);
        
        if (progress % 33 >= 20) { // Show result for completed role
            const roleIndex = Math.floor(progress / 33);
            if (data.context?.result?.compatible_roles?.[roleIndex]) {
                const roleResult = data.context.result.compatible_roles[roleIndex];
                const confidence = (roleResult.confidence * 10).toFixed(1);
                showIntermediateResult('step-compatibility', 
                    `${roleResult.role}: ${confidence}/10 (${roleResult.compatible ? 'Compatible' : 'Not compatible'})`);
            }
        }
    } else {
        updateStepProgress('step-compatibility', progress, 'Finalizing compatibility analysis...');
    }
}

function updateScoringProgress(data, progress) {
    updateStepProgress('step-score', progress);
    
    if (progress >= 20) {
        showIntermediateResult('step-score', 'Analyzing profile content...');
    }
    
    if (progress >= 40 && data.context?.result?.analysis_stage) {
        showIntermediateResult('step-score', `Stage: ${data.context.result.analysis_stage}`);
    }
    
    if (progress >= 60 && data.context?.result?.reasoning_preview) {
        showIntermediateResult('step-score', `Analysis: ${data.context.result.reasoning_preview}`);
    }
    
    if (progress >= 80 && data.context?.result?.confidence) {
        const confidence = Math.round(data.context.result.confidence * 100);
        showIntermediateResult('step-score', `Confidence: ${confidence}%`);
    }
}

function updateJiraProgress(data, progress) {
    const fields = [
        { name: 'FIT Score', key: 'fit_score', threshold: 25 },
        { name: 'FIT Status', key: 'fit_status', threshold: 50 },
        { name: 'Standing', key: 'standing', threshold: 75 },
        { name: 'Additional Data', key: 'additional_data', threshold: 90 }
    ];
    
    updateStepProgress('step-update_jira', progress, 'Updating JIRA fields...');
    
    fields.forEach(field => {
        if (progress >= field.threshold && data.context?.result?.[field.key]) {
            showIntermediateResult('step-update_jira', `${field.name}: ${data.context.result[field.key]}`);
        }
    });
}

// Step timing and ETA calculation
class StepTimer {
    constructor() {
        this.stepTimes = {
            'verify': { avg: 3000, variance: 1000 },
            'ingest': { avg: 5000, variance: 2000 },
            'compatibility': { avg: 8000, variance: 3000 },
            'score': { avg: 12000, variance: 5000 },
            'update_jira': { avg: 4000, variance: 1500 }
        };
        this.stepStartTimes = {};
    }
    
    startStep(stepName) {
        this.stepStartTimes[stepName] = Date.now();
    }
    
    getETA(stepName, currentProgress) {
        const startTime = this.stepStartTimes[stepName];
        if (!startTime || currentProgress === 0) return null;
        
        const elapsed = Date.now() - startTime;
        const estimatedTotal = (elapsed / currentProgress) * 100;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        
        if (remaining < 1000) return 'Almost done...';
        if (remaining < 60000) return `~${Math.round(remaining / 1000)}s remaining`;
        return `~${Math.round(remaining / 60000)}m remaining`;
    }
    
    getAverageStepTime(stepName) {
        return this.stepTimes[stepName] || { avg: 5000, variance: 2000 };
    }
}

// Tests
describe('Step-Specific Progress Indicators', () => {
    
    describe('createStepProgressBar', () => {
        test('should create progress bar for valid step', () => {
            const progressContainer = createStepProgressBar('step-verify', 25);
            
            expect(progressContainer).toBeTruthy();
            expect(progressContainer.className).toBe('step-progress mt-2');
            expect(progressContainer.innerHTML).toContain('progress-bar');
            expect(progressContainer.innerHTML).toContain('25%');
        });
        
        test('should return null for invalid step', () => {
            // Mock getElementById to return null
            const originalGetElementById = document.getElementById;
            document.getElementById = () => null;
            
            const result = createStepProgressBar('invalid-step');
            expect(result).toBeNull();
            
            document.getElementById = originalGetElementById;
        });
        
        test('should not create duplicate progress bars', () => {
            const step = document.getElementById('step-verify');
            step.stepProgress = new MockElement('div');
            step.stepProgress.className = 'step-progress mt-2';
            
            const result = createStepProgressBar('step-verify');
            expect(result).toBe(step.stepProgress);
        });
    });
    
    describe('updateStepProgress', () => {
        test('should update progress bar width', () => {
            const step = document.getElementById('step-verify');
            createStepProgressBar('step-verify', 0);
            
            updateStepProgress('step-verify', 75);
            
            const progressBar = step.querySelector('.progress-bar');
            expect(progressBar.style.width).toBe('75%');
            expect(progressBar.attributes['aria-valuenow']).toBe('75');
        });
        
        test('should clamp progress values', () => {
            createStepProgressBar('step-verify', 0);
            const step = document.getElementById('step-verify');
            
            updateStepProgress('step-verify', 150);
            expect(step.querySelector('.progress-bar').style.width).toBe('100%');
            
            updateStepProgress('step-verify', -25);
            expect(step.querySelector('.progress-bar').style.width).toBe('0%');
        });
        
        test('should add details and ETA', () => {
            createStepProgressBar('step-verify', 0);
            
            updateStepProgress('step-verify', 50, 'Processing URL...', '~5s remaining');
            
            const step = document.getElementById('step-verify');
            const details = step.querySelector('.step-details');
            const eta = step.querySelector('.step-eta');
            
            expect(details.textContent).toBe('Processing URL...');
            expect(eta.textContent).toBe('~5s remaining');
        });
    });
    
    describe('showIntermediateResult', () => {
        test('should add intermediate result with timestamp', () => {
            const step = document.getElementById('step-verify');
            
            showIntermediateResult('step-verify', 'Testing LinkedIn URL access');
            
            const intermediate = step.querySelector('.intermediate-results');
            expect(intermediate).toBeTruthy();
            expect(intermediate.children.length).toBe(1);
            
            const result = intermediate.children[0];
            expect(result.innerHTML).toContain('Testing LinkedIn URL access');
            expect(result.innerHTML).toContain(new Date().toLocaleTimeString());
        });
        
        test('should limit to 5 intermediate results', () => {
            const step = document.getElementById('step-verify');
            
            // Add 7 results
            for (let i = 0; i < 7; i++) {
                showIntermediateResult('step-verify', `Result ${i}`);
            }
            
            const intermediate = step.querySelector('.intermediate-results');
            expect(intermediate.children.length).toBe(5);
        });
        
        test('should handle different result types', () => {
            showIntermediateResult('step-verify', 'Success message', 'success');
            showIntermediateResult('step-verify', 'Error message', 'error');
            showIntermediateResult('step-verify', 'Info message', 'info');
            
            const step = document.getElementById('step-verify');
            const intermediate = step.querySelector('.intermediate-results');
            
            expect(intermediate.children[0].innerHTML).toContain('bi-check-circle');
            expect(intermediate.children[1].innerHTML).toContain('bi-exclamation-triangle');
            expect(intermediate.children[2].innerHTML).toContain('bi-info-circle');
        });
    });
    
    describe('Step-specific progress updates', () => {
        test('updateVerificationProgress should show URL and status', () => {
            createStepProgressBar('step-verify', 0);
            
            const data = {
                context: {
                    result: {
                        linkedin_url: 'https://www.linkedin.com/in/johndoe',
                        status: '200 OK',
                        profile_accessible: true
                    }
                }
            };
            
            updateVerificationProgress(data, 25);
            updateVerificationProgress(data, 60);
            updateVerificationProgress(data, 90);
            
            const step = document.getElementById('step-verify');
            const intermediate = step.querySelector('.intermediate-results');
            
            expect(intermediate.children.length).toBe(3);
            expect(intermediate.innerHTML).toContain('johndoe');
            expect(intermediate.innerHTML).toContain('200 OK');
            expect(intermediate.innerHTML).toContain('Profile is accessible');
        });
        
        test('updateIngestionProgress should show extracted fields', () => {
            createStepProgressBar('step-ingest', 0);
            
            const data = {
                context: {
                    result: {
                        profile_name: 'Jane Smith',
                        current_title: 'Senior Engineer',
                        current_company: 'Tech Corp',
                        years_experience: 8
                    }
                }
            };
            
            updateIngestionProgress(data, 25);
            updateIngestionProgress(data, 50);
            updateIngestionProgress(data, 75);
            updateIngestionProgress(data, 90);
            
            const step = document.getElementById('step-ingest');
            const intermediate = step.querySelector('.intermediate-results');
            
            expect(intermediate.children.length).toBe(4);
            expect(intermediate.innerHTML).toContain('Jane Smith');
            expect(intermediate.innerHTML).toContain('Senior Engineer');
            expect(intermediate.innerHTML).toContain('Tech Corp');
            expect(intermediate.innerHTML).toContain('8 years');
        });
        
        test('updateCompatibilityProgress should show role-by-role analysis', () => {
            createStepProgressBar('step-compatibility', 0);
            
            const data = {
                context: {
                    result: {
                        compatible_roles: [
                            { role: 'CIO', confidence: 0.72, compatible: true },
                            { role: 'CTO', confidence: 0.89, compatible: true },
                            { role: 'CISO', confidence: 0.61, compatible: false }
                        ]
                    }
                }
            };
            
            updateCompatibilityProgress(data, 25);
            updateCompatibilityProgress(data, 60);
            updateCompatibilityProgress(data, 90);
            
            const step = document.getElementById('step-compatibility');
            const progressBar = step.querySelector('.progress-bar');
            const details = step.querySelector('.step-details');
            
            expect(progressBar.style.width).toBe('90%');
            expect(details.textContent).toContain('Analyzing CTO compatibility...');
        });
        
        test('updateScoringProgress should show analysis stages', () => {
            createStepProgressBar('step-score', 0);
            
            const data = {
                context: {
                    result: {
                        analysis_stage: 'Evaluating technical skills',
                        reasoning_preview: 'Strong background in software architecture...',
                        confidence: 0.92
                    }
                }
            };
            
            updateScoringProgress(data, 25);
            updateScoringProgress(data, 50);
            updateScoringProgress(data, 75);
            updateScoringProgress(data, 90);
            
            const step = document.getElementById('step-score');
            const intermediate = step.querySelector('.intermediate-results');
            
            expect(intermediate.children.length).toBe(4);
            expect(intermediate.innerHTML).toContain('Analyzing profile content...');
            expect(intermediate.innerHTML).toContain('Evaluating technical skills');
            expect(intermediate.innerHTML).toContain('Strong background in software architecture');
            expect(intermediate.innerHTML).toContain('Confidence: 92%');
        });
        
        test('updateJiraProgress should show field-by-field updates', () => {
            createStepProgressBar('step-update_jira', 0);
            
            const data = {
                context: {
                    result: {
                        fit_score: 87,
                        fit_status: 'Scored',
                        standing: 'Good Qualified Candidate',
                        additional_data: 'Updated profile metadata'
                    }
                }
            };
            
            updateJiraProgress(data, 30);
            updateJiraProgress(data, 60);
            updateJiraProgress(data, 80);
            updateJiraProgress(data, 95);
            
            const step = document.getElementById('step-update_jira');
            const intermediate = step.querySelector('.intermediate-results');
            
            expect(intermediate.children.length).toBe(4);
            expect(intermediate.innerHTML).toContain('FIT Score: 87');
            expect(intermediate.innerHTML).toContain('FIT Status: Scored');
            expect(intermediate.innerHTML).toContain('Standing: Good Qualified Candidate');
            expect(intermediate.innerHTML).toContain('Additional Data: Updated profile metadata');
        });
    });
    
    describe('StepTimer', () => {
        test('should calculate ETA based on progress', () => {
            const timer = new StepTimer();
            timer.startStep('verify');
            
            // Mock elapsed time
            timer.stepStartTimes['verify'] = Date.now() - 2000; // 2 seconds ago
            
            const eta = timer.getETA('verify', 40); // 40% complete
            expect(eta).toContain('remaining');
        });
        
        test('should return null for steps not started', () => {
            const timer = new StepTimer();
            const eta = timer.getETA('verify', 50);
            expect(eta).toBeNull();
        });
        
        test('should return appropriate messages for short times', () => {
            const timer = new StepTimer();
            timer.stepStartTimes['verify'] = Date.now() - 500; // 0.5 seconds ago
            
            const eta = timer.getETA('verify', 95); // Almost done
            expect(eta).toBe('Almost done...');
        });
        
        test('should have default step times', () => {
            const timer = new StepTimer();
            const verifyTime = timer.getAverageStepTime('verify');
            const unknownTime = timer.getAverageStepTime('unknown');
            
            expect(verifyTime.avg).toBe(3000);
            expect(unknownTime.avg).toBe(5000);
        });
    });
});

describe('Integration with Enhanced Modal Logging', () => {
    test('should combine progress updates with rich logging', () => {
        createStepProgressBar('step-verify', 0);
        
        const mockData = {
            context: {
                result: {
                    linkedin_url: 'https://www.linkedin.com/in/testuser'
                }
            }
        };
        
        // Update progress
        updateStepProgress('step-verify', 50, 'Checking URL accessibility...');
        updateVerificationProgress(mockData, 50);
        
        const step = document.getElementById('step-verify');
        const progressBar = step.querySelector('.progress-bar');
        const intermediate = step.querySelector('.intermediate-results');
        
        expect(progressBar.style.width).toBe('50%');
        expect(intermediate.children.length).toBe(1);
        expect(intermediate.innerHTML).toContain('testuser');
    });
    
    test('should handle complete processing pipeline with progress', () => {
        const steps = ['verify', 'ingest', 'compatibility', 'score', 'update_jira'];
        
        steps.forEach(step => {
            createStepProgressBar(`step-${step}`, 0);
        });
        
        // Simulate processing pipeline
        const timer = new StepTimer();
        
        steps.forEach(step => {
            timer.startStep(step);
            updateStepProgress(`step-${step}`, 100);
        });
        
        steps.forEach(step => {
            const stepEl = document.getElementById(`step-${step}`);
            const progressBar = stepEl.querySelector('.progress-bar');
            expect(progressBar.style.width).toBe('100%');
        });
    });
});