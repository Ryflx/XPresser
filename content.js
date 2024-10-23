// Add debugging
let DEBUG = true;
function log(...args) {
    if (DEBUG) console.log('[CLM Extension]:', ...args);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('Message received:', request);
    
    if (request.action === "getFields") {
        getFieldsFromPage().then(fields => {
            log('Fields found:', fields);
            sendResponse({fields: fields});
        }).catch(error => {
            log('Error getting fields:', error);
            sendResponse({error: error.message});
        });
        return true; // Keep the message channel open for async response
    } else if (request.action === "applyStatement") {
        log('Applying statement:', request.statement);
        applyStatement(request.statement).then(result => {
            log('Statement applied:', result);
            sendResponse({success: result});
        }).catch(error => {
            log('Error applying statement:', error);
            sendResponse({error: error.message});
        });
        return true; // Keep the message channel open for async response
    }
});

async function getFieldsFromPage() {
    log('Starting field extraction');
    
    // Wait for elements to be present
    await waitForElements('input[id^="merge-tag-value-"], textarea[id*="merge"], label[for^="field-"]');
    
    const fields = new Set();
    let attempts = 0;
    const maxAttempts = 3;

    while (fields.size === 0 && attempts < maxAttempts) {
        attempts++;
        log(`Attempt ${attempts} to extract fields`);

        // Try to extract fields from various sources
        await extractFieldsFromInputs(fields);
        if (fields.size === 0) await extractFieldsFromTextareas(fields);
        if (fields.size === 0) await extractFieldsFromLabels(fields);
        if (fields.size === 0) await extractFieldsFromGeneral(fields);

        if (fields.size === 0) {
            log(`No fields found in attempt ${attempts}, waiting before retry`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
    }

    if (fields.size === 0) {
        throw new Error('Failed to extract any fields after multiple attempts');
    }

    // Convert Set to array of objects
    const fieldArray = Array.from(fields).map(field => ({
        displayValue: field.replace(/^\/\//, ''),  // Remove // for display
        actualValue: `//${field.replace(/^\/\//, '')}` // Ensure single // prefix
    }));

    log('Final processed fields:', fieldArray);
    return fieldArray;
}

async function extractFieldsFromInputs(fields) {
    log('Extracting fields from inputs');
    const mergeTagInputs = document.querySelectorAll('input[id^="merge-tag-value-"]');
    log('Number of merge tag inputs found:', mergeTagInputs.length);

    mergeTagInputs.forEach((input, index) => {
        const value = input.value;
        log(`Processing input ${index}:`, value);

        if (value) {
            const pattern = /<#\s*<Content Select="(\/\/.*?)".*?\/>\s*#>/;
            const matches = value.match(pattern);
            
            if (matches && matches[1]) {
                const fieldPath = matches[1];
                log('Found field:', fieldPath);
                fields.add(fieldPath);
            }
        }
    });
}

async function extractFieldsFromTextareas(fields) {
    log('Extracting fields from textareas');
    const textareas = document.querySelectorAll('textarea[id*="merge"]');
    textareas.forEach((textarea, index) => {
        const value = textarea.value;
        log(`Checking textarea ${index}:`, value);
        const matches = value.match(/<#\s*<Content Select="(\/\/.*?)".*?\/>\s*#>/g);
        if (matches) {
            matches.forEach(match => {
                const fieldPath = match.replace(/<#\s*<Content Select="(\/\/.*?)".*?\/>\s*#>/, '$1');
                log('Extracted field:', fieldPath);
                fields.add(fieldPath);
            });
        }
    });
}

async function extractFieldsFromLabels(fields) {
    log('Extracting fields from labels');
    const fieldLabels = document.querySelectorAll('label[for^="field-"]');
    fieldLabels.forEach((label, index) => {
        const fieldName = label.textContent.trim();
        if (fieldName) {
            const fullPath = `//${fieldName}`;
            log(`Found field label ${index}:`, fullPath);
            fields.add(fullPath);
        }
    });
}

async function extractFieldsFromGeneral(fields) {
    log('Extracting fields from general elements');
    document.querySelectorAll('input, select, textarea').forEach((element, index) => {
        if (element.id || element.name) {
            const fieldName = element.id || element.name;
            const fullPath = `//${fieldName}`;
            log(`Found general field ${index}:`, fullPath);
            fields.add(fullPath);
        }
    });
}

async function applyStatement(statement) {
    log('Applying statement:', statement);

    // Wait for textarea elements to be present
    await waitForElements('textarea[id*="merge"], textarea[id*="condition"], textarea[id*="statement"], textarea');

    // Try multiple selectors to find the textarea
    const textareaSelectors = [
        'textarea[id*="merge"]',
        'textarea[id*="condition"]',
        'textarea[id*="statement"]',
        'textarea'
    ];

    let textarea;
    for (let selector of textareaSelectors) {
        textarea = document.querySelector(selector);
        if (textarea) {
            log(`Found textarea with selector: ${selector}`);
            break;
        }
    }

    if (!textarea) {
        throw new Error('Could not find target textarea');
    }

    // Apply the statement
    const originalValue = textarea.value;
    textarea.value += '\n' + statement;

    // Trigger input event to ensure any listeners are notified
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);

    log('Statement applied successfully');
    log('Original textarea value:', originalValue);
    log('New textarea value:', textarea.value);

    return true;
}

// Helper function to wait for elements
function waitForElements(selector) {
    return new Promise((resolve) => {
        if (document.querySelectorAll(selector).length > 0) {
            log(`Elements found immediately: ${selector}`);
            resolve();
        }

        const observer = new MutationObserver((mutations) => {
            if (document.querySelectorAll(selector).length > 0) {
                log(`Elements found after mutation: ${selector}`);
                observer.disconnect();
                resolve();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            log(`Timeout reached waiting for elements: ${selector}`);
            observer.disconnect();
            resolve();
        }, 10000);
    });
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    log('Content script loaded');
    if (isTargetUrl()) {
        log('On target URL - ready to fetch fields');
    }
});

// Also check when URL changes (for single-page apps)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        if (isTargetUrl()) {
            log('URL changed to target URL - ready to fetch fields');
        }
    }
}).observe(document, {subtree: true, childList: true});

function isTargetUrl() {
    const isTarget = window.location.href.includes('springcm.com/atlas/Admin/FormConfig');
    log('Checking URL:', window.location.href, 'Is target:', isTarget);
    return isTarget;
}
