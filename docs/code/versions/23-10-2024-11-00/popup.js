console.log('Popup script started');

// Add debugging
let DEBUG = true;
function log(...args) {
    if (DEBUG) console.log('[CLM Extension Popup]:', ...args);
}

log('Debug logging initialized');

document.addEventListener('DOMContentLoaded', function() {
    log('DOMContentLoaded event fired');
    
    // Get references to DOM elements
    const fieldSelect = document.getElementById('field');
    const advancedFieldSelect = document.getElementById('advanced-field');
    const operatorSelect = document.getElementById('operator');
    const valueInput = document.getElementById('value');
    const advancedXPathInput = document.getElementById('advanced-xpath');
    const generateButton = document.getElementById('generate');
    const copyButton = document.getElementById('copy');
    const loadCacheButton = document.getElementById('loadCache');
    const clearCacheButton = document.getElementById('clearCache');
    const outputArea = document.getElementById('output');
    const statusElement = document.getElementById('status');
    const showXmlUploadCheckbox = document.getElementById('showXmlUpload');
    const xmlUploadSection = document.getElementById('xmlUploadSection');
    const xmlUpload = document.getElementById('xmlUpload');
    const uploadButton = document.getElementById('uploadButton');

    // Tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    let currentTab = 'simple';

    // Store fields for reference
    let fields = [];

    // Update status to show script is running
    updateStatus('Extension loaded successfully');

    // Load fields immediately
    loadFields();

    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    function switchTab(tabName) {
        currentTab = tabName;
        
        // Update button states
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });

        // Update content visibility
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Clear the output area when switching tabs
        outputArea.value = '';
    }

    // Event Listeners
    uploadButton.addEventListener('click', handleXMLUpload);
    generateButton.addEventListener('click', generateStatement);
    copyButton.addEventListener('click', copyToClipboard);
    loadCacheButton.addEventListener('click', loadFieldsFromCache);
    clearCacheButton.addEventListener('click', clearCache);
    
    // Add field select change handlers
    fieldSelect.addEventListener('change', handleFieldChange);
    advancedFieldSelect.addEventListener('change', handleAdvancedFieldChange);

    showXmlUploadCheckbox.addEventListener('change', function() {
        xmlUploadSection.classList.toggle('hidden', !this.checked);
        
        // Clear file input when hiding section
        if (!this.checked) {
            xmlUpload.value = '';
        }
    });

    function handleFieldChange() {
        log('Field selection changed:', this.value);
        const selectedField = fields.find(f => f.actualValue === this.value);
        log('Selected field:', selectedField);
        
        if (selectedField && selectedField.nodeValue) {
            log('Setting value input to:', selectedField.nodeValue);
            valueInput.value = selectedField.nodeValue;
        } else {
            log('No nodeValue found for selected field');
            valueInput.value = '';
        }
    }

    function handleAdvancedFieldChange() {
        const selectedField = fields.find(f => f.actualValue === this.value);
        if (selectedField) {
            // Pre-populate the XPath textarea with a template
            advancedXPathInput.value = `${selectedField.actualValue}[custom_condition]`;
        } else {
            advancedXPathInput.value = '';
        }
    }

    function updateStatus(message) {
        log('Status update:', message);
        statusElement.textContent = message;
    }

    function clearCache() {
        log('Clearing fields cache...');
        updateStatus('Clearing cache...');
        
        chrome.storage.local.remove('fieldsCache', function() {
            if (chrome.runtime.lastError) {
                log('Error clearing cache:', chrome.runtime.lastError);
                showError('Failed to clear cache');
                return;
            }
            
            // Clear the fields array
            fields = [];
            
            // Reset dropdowns
            [fieldSelect, advancedFieldSelect].forEach(select => {
                select.innerHTML = '<option value="">-- Select Field --</option>';
            });
            
            log('Cache cleared successfully');
            updateStatus('Cache cleared successfully');
        });
    }

    function loadFields() {
        updateStatus('Loading fields...');
        log('Loading fields...');
        
        // Show loading state in both dropdowns
        fieldSelect.innerHTML = '<option value="">Loading fields...</option>';
        advancedFieldSelect.innerHTML = '<option value="">Loading fields...</option>';
        fieldSelect.disabled = true;
        advancedFieldSelect.disabled = true;

        // Set a timeout to clear the loading message after 2 seconds
        setTimeout(() => {
            if (fieldSelect.innerHTML === '<option value="">Loading fields...</option>') {
                fieldSelect.innerHTML = '<option value="">-- Select Field --</option>';
                advancedFieldSelect.innerHTML = '<option value="">-- Select Field --</option>';
                fieldSelect.disabled = false;
                advancedFieldSelect.disabled = false;
                updateStatus('Fields not loaded. Please try again.');
            }
        }, 2000);
        
        // Check if fields are available in cache first
        chrome.storage.local.get('fieldsCache', function(data) {
            if (data.fieldsCache) {
                log('Fields found in cache, loading from cache');
                populateFieldDropdowns(data.fieldsCache);
                updateStatus('Fields loaded from cache');
            } else {
                log('No fields in cache, querying active tab');

                // Query active tab
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (!tabs[0]) {
                        log('No active tab found');
                        showError('Unable to access current tab');
                        return;
                    }

                    log('Sending message to content script');
                    chrome.tabs.sendMessage(tabs[0].id, {action: "getFields"}, function(response) {
                        if (chrome.runtime.lastError) {
                            log('Error:', chrome.runtime.lastError);
                            showError('Unable to communicate with page. Please refresh and try again.');
                            return;
                        }

                        log('Received response:', response);
                        if (response && response.fields) {
                            populateFieldDropdowns(response.fields);
                            // Store fields in local cache
                            chrome.storage.local.set({fieldsCache: response.fields}, function() {
                                log('Fields stored in cache');
                            });
                        } else {
                            showError('No fields found on page');
                        }
                    });
                });
            }
        });
    }

    function loadFieldsFromCache() {
        updateStatus('Loading fields from cache...');
        log('Loading fields from cache...');
        
        chrome.storage.local.get('fieldsCache', function(data) {
            if (data.fieldsCache) {
                fields = data.fieldsCache; // Update the global fields array
                log('Fields loaded from cache:', fields);
                populateFieldDropdowns(fields);
                updateStatus('Fields loaded from cache');
            } else {
                showError('No cached fields found');
            }
        });
    }

    function populateFieldDropdowns(fieldsData) {
        log('Populating dropdowns with:', fieldsData);
        
        [fieldSelect, advancedFieldSelect].forEach(select => {
            select.innerHTML = '';
            select.disabled = false;
        
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- Select Field --';
            select.appendChild(defaultOption);
        });
    
        // Create a Set to track added options
        const addedOptions = new Set();
    
        // Add fields, skipping duplicates
        fieldsData.forEach(field => {
            if (!addedOptions.has(field.displayValue)) {
                addedOptions.add(field.displayValue);
                
                // Add to both dropdowns
                [fieldSelect, advancedFieldSelect].forEach(select => {
                    const option = document.createElement('option');
                    option.value = field.actualValue;
                    option.textContent = field.displayValue;
                    select.appendChild(option);
                });
            }
        });
        
        log('Dropdowns populated with unique fields:', addedOptions.size);
        updateStatus(`Successfully loaded ${addedOptions.size} fields from page`);
    }

    function showError(message) {
        log('Error:', message);
        [fieldSelect, advancedFieldSelect].forEach(select => {
            select.innerHTML = `<option value="">${message}</option>`;
            select.disabled = true;
        });
        outputArea.value = `Error: ${message}`;
        updateStatus(`Error: ${message}`);
    }

    function parseNumericInput(value) {
        // Remove commas and convert to number
        const cleanedValue = value.replace(/,/g, '');
        const number = parseFloat(cleanedValue);
        
        if (isNaN(number)) {
            throw new Error('Please enter a valid number');
        }
        
        return number;
    }

    function generateStatement() {
        updateStatus('Generating statement...');
        log('Generating statement');

        let statement = '';

        try {
            if (currentTab === 'simple') {
                const field = fieldSelect.value;
                const operator = operatorSelect.value;
                const value = valueInput.value;

                if (!field) {
                    showError('Please select a field');
                    return;
                }

                switch (operator) {
                    case 'hasValueOf':
                        statement = `<# <Conditional Test="${field}[text() = '${value}']" /> #>`;
                        break;
                    case 'doesNotHaveValueOf':
                        statement = `<# <Conditional Test="not(${field}[text() = '${value}'])" /> #>`;
                        break;
                    case 'hasAnyValue':
                        statement = `<# <Conditional Test="${field}" /> #>`;
                        break;
                    case 'hasNoValue':
                        statement = `<# <Conditional Test="not(${field})" /> #>`;
                        break;
                    case 'multipleValues':
                        const values = value.split(',').map(v => v.trim());
                        statement = `<# <Conditional Test="${field}[${values.map(v => `text() = '${v}'`).join(' or ')}]" /> #>`;
                        break;
                    case 'dateEquals':
                        const formattedDate = value.replace(/[^0-9]/g, '');
                        statement = `<# <Conditional Test="${field}_unformatted[number(substring-before(translate(text(),'-',''),'T')) = ${formattedDate}]" /> #>`;
                        break;
                    case 'dateNotEquals':
                        const formattedDateNot = value.replace(/[^0-9]/g, '');
                        statement = `<# <Conditional Test="not(${field}_unformatted[number(substring-before(translate(text(),'-',''),'T')) = ${formattedDateNot}])" /> #>`;
                        break;
                    case 'checkboxChecked':
                        statement = `<# <Conditional Test="${field}/text()" /> #>`;
                        break;
                    case 'checkboxUnchecked':
                        statement = `<# <Conditional Test="not(${field}/text())" /> #>`;
                        break;
                    case 'numericEquals':
                    case 'numericGreaterThan':
                    case 'numericLessThan':
                        const numericValue = parseNumericInput(value);
                        const numericOperator = operator === 'numericEquals' ? '=' : operator === 'numericGreaterThan' ? '>' : '<';
                        statement = `<# <Conditional Test="number(${field}) ${numericOperator} ${numericValue}" /> #>`;
                        break;
                    case 'SuppressListItem':
                        statement = `<# <SuppressListItem Test="${field}[contains(text(), '${value}')]" /> #>`;
                        break;
                    default:
                        throw new Error('Invalid operator selected');
                }
            } else {
                // Advanced tab
                const field = advancedFieldSelect.value;
                const xpath = advancedXPathInput.value.trim();

                if (!xpath) {
                    showError('Please enter an XPath expression');
                    return;
                }

                statement = `<# <Conditional Test="${xpath}" /> #>`;
            }

            if (statement) {
                outputArea.value = statement;
                log('Generated statement:', statement);
                updateStatus('Statement generated successfully');

                // Only try to apply statement if we're on the target page
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (!tabs[0] || !tabs[0].url.includes('springcm.com/atlas/Admin/FormConfig')) {
                        log('Not on target page, skipping apply');
                        return;
                    }

                    log('Sending statement to content script');
                    updateStatus('Applying statement to page...');
                    chrome.tabs.sendMessage(tabs[0].id, {action: "applyStatement", statement: statement}, function(response) {
                        if (chrome.runtime.lastError) {
                            log('Error:', chrome.runtime.lastError);
                            return;
                        }

                        if (response && response.success) {
                            log('Statement successfully applied to the page');
                            updateStatus('Statement applied successfully');
                        }
                    });
                });
            }
        } catch (error) {
            log('Error generating statement:', error);
            outputArea.value = `Error: ${error.message}`;
            updateStatus(`Error: ${error.message}`);
        }
    }

    function copyToClipboard() {
        outputArea.select();
        document.execCommand('copy');
        
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copied!';
        updateStatus('Statement copied to clipboard');
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 1500);
    }

    function handleXMLUpload() {
        const file = xmlUpload.files[0];
        if (!file) {
            showError('Please select an XML file first');
            return;
        }
    
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const xmlContent = e.target.result;
                console.log('XML content loaded:', xmlContent);
                
                const parsedFields = parseXMLFields(xmlContent);
                console.log('Fields after parsing:', parsedFields);
                
                if (parsedFields.length > 0) {
                    fields = parsedFields; // Update the global fields array
                    
                    // Store fields in cache
                    chrome.storage.local.set({fieldsCache: fields}, function() {
                        console.log('Fields stored in cache:', fields);
                        populateFieldDropdowns(fields);
                        updateStatus('Fields loaded from XML successfully');
                        createNotification('XML parsed successfully, fields loaded into dropdown');
                    });
                } else {
                    showError('No valid fields found in XML');
                }
            } catch (error) {
                console.error('Error parsing XML:', error);
                showError('Error parsing XML file');
            }
        };
    
        reader.onerror = function() {
            showError('Error reading file');
        };
    
        reader.readAsText(file);
    }

    function parseXMLFields(xmlContent) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        let allFields = [];
        
        console.log('Starting XML parsing');

        function traverseXML(node) {
            // Skip text nodes and nodes with CDATA
            if (node.nodeType === 3 || node.nodeType === 4) return;
            
            // Check if this is a leaf node (no element children)
            const hasElementChildren = Array.from(node.children).some(child => 
                child.nodeType === 1 && !child.textContent.includes('CDATA')
            );

            if (!hasElementChildren && node.nodeType === 1) {
                const nodeValue = node.textContent.trim();
                // Clean the node name by removing anything in parentheses and trimming
                const cleanNodeName = node.nodeName.replace(/\s*\([^)]*\)\s*/g, '').trim();
                const nodePath = `//${cleanNodeName}`;
                
                // Skip empty nodes or nodes with specific suffixes
                if (!nodeValue || 
                    cleanNodeName.endsWith('_unformatted') ||
                    cleanNodeName.endsWith('Container') ||
                    cleanNodeName.endsWith('_Id')) {
                    return;
                }

                console.log('Processing field:', {
                    nodeName: cleanNodeName,
                    value: nodeValue
                });

                allFields.push({
                    displayValue: cleanNodeName,
                    actualValue: nodePath,
                    value: nodeValue
                });
            }

            // Recursively process child nodes
            Array.from(node.children).forEach(child => {
                traverseXML(child);
            });
        }

        traverseXML(xmlDoc.documentElement);
        
        // Remove duplicates using Set and reduce
        console.log('Before duplicate removal:', allFields.length, 'fields');
        
        // Create a Map to store unique fields
        const uniqueFieldsMap = new Map();
        
        // Only keep the first occurrence of each displayValue
        allFields.forEach(field => {
            if (!uniqueFieldsMap.has(field.displayValue)) {
                uniqueFieldsMap.set(field.displayValue, field);
            }
        });
        
        // Convert Map back to array and sort
        const uniqueFields = Array.from(uniqueFieldsMap.values())
            .sort((a, b) => a.displayValue.localeCompare(b.displayValue));
        
        console.log('After duplicate removal:', uniqueFields.length, 'fields');
        console.log('Final unique fields:', uniqueFields.map(f => f.displayValue));
        
        return uniqueFields;
    }
});

console.log('Popup script finished loading');
