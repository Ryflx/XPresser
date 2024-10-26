// Set up logging at the very top of popup.js
console.log('Popup script initializing...'); // Initial test log

// Ensure debug is true and logging function is working
const DEBUG = true;

function log(...args) {
    if (DEBUG) {
        console.log('[CLM Extension]:', ...args);
    }
}

// Test the logging immediately
log('Logging system initialized');

document.addEventListener('DOMContentLoaded', function() {
    log('DOMContentLoaded event fired');
    
    // Get references to DOM elements
    const fieldSelect = document.getElementById('field');
    const advancedFieldSelect = document.getElementById('advanced-field');
    const operatorSelect = document.getElementById('operator');
    const advancedOperatorSelect = document.getElementById('advanced-operator');
    const valueInput = document.getElementById('value');
    const advancedXPathInput = document.getElementById('advanced-xpath');
    const generateButton = document.getElementById('generate');
    const copyButton = document.getElementById('copy');
    const loadCacheButton = document.getElementById('loadCache');
    const clearCacheButton = document.getElementById('clearCache');
    const outputArea = document.getElementById('output');
    const statusElement = document.getElementById('status');
    const showXmlUploadCheckbox = document.getElementById('showXmlUpload');
    const xmlInput = document.getElementById('xmlInput');
    const xmlInputSection = document.getElementById('xmlInputSection');
    xmlInputSection.classList.add('hidden');

    showXmlUploadCheckbox.addEventListener('change', function() {
        xmlInputSection.classList.toggle('hidden', !this.checked);
        
        // Clear textarea when hiding section
        if (!this.checked) {
            document.getElementById('xmlInput').value = '';
        } else {
            // Load cached XML when showing section
            loadCachedXML();
        }
    });

    if (clearCacheButton) {
        clearCacheButton.addEventListener('click', () => {
            console.log('Clear cache clicked'); // Debug log
            clearAllCache();
        });
    } else {
        console.error('Clear cache button not found!');
    }

    const processXmlButton = document.getElementById('processXmlButton');
    processXmlButton.addEventListener('click', function() {
        handleXMLInput();
    });

    const customXPathSection = document.getElementById('custom-xpath-section');
    const tableRowSection = document.getElementById('table-row-section');
    const parentNodeSelect = document.getElementById('parent-node');
    const tablePreview = document.getElementById('table-preview');

    const style = document.createElement('style');
    style.textContent = `
        #table-preview {
            font-family: monospace;
            white-space: pre;
            background-color: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 4px;
        }
        
        #table-preview .dynamic-table {
            border-collapse: collapse;
            margin: 10px 0;
            color: #d4d4d4;
        }
        
        #table-preview .dynamic-table th,
        #table-preview .dynamic-table td {
            border: 1px solid #404040;
            padding: 8px;
            text-align: left;
        }
        
        #table-preview .dynamic-table th {
            background-color: #2d2d2d;
        }

        /* Add the status styles here */
        #status {
            overflow: hidden;
            max-height: 50px;
            margin-bottom: 15px;
            padding: 5px 0;
            color: #333;
            font-size: 14px;
            transform-origin: top;
            transition: 
                opacity 0.5s ease-in-out,
                max-height 0.5s ease-in-out,
                margin 0.5s ease-in-out,
                padding 0.5s ease-in-out,
                transform 0.5s ease-in-out;
        }

        #status.hidden {
            opacity: 0;
            max-height: 0;
            margin: 0;
            padding: 0;
            transform: scaleY(0);
            pointer-events: none;
        }
`;
document.head.appendChild(style);

    // Add fade out functionality for status element
    let statusTimeout;
    function updateStatus(message) {
        log('Status update:', message);
        
        // Clear any existing timeout
        if (statusTimeout) {
            clearTimeout(statusTimeout);
        }
        
        // Reset state
        statusElement.textContent = message;
        statusElement.classList.remove('hidden');
        
        // Set new timeout
        statusTimeout = setTimeout(() => {
            statusElement.classList.add('hidden');
        }, 3000); // Collapse and fade out after 3 seconds
    }

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

    // Advanced operator change handler
    advancedOperatorSelect.addEventListener('change', function() {
        const isTableRow = this.value === 'tableRow';
        customXPathSection.classList.toggle('hidden', isTableRow);
        tableRowSection.classList.toggle('hidden', !isTableRow);
        
        if (isTableRow) {
            populateParentNodes();
        }
    });

    // Parent node change handler
    parentNodeSelect.addEventListener('change', function() {
        if (this.value) {
            generateTablePreview(this.value);
        } else {
            tablePreview.value = '';
        }
    });

    function handleXMLInput() {
        const xmlContent = xmlInput.value.trim();
        
        if (!xmlContent) {
            showError('Please paste XML content first');
            return;
        }

        updateStatus('Processing XML content...');
        log('Starting XML processing');

        try {
            // Parse XML content
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.getElementsByTagName('parsererror');
            if (parserError.length > 0) {
                throw new Error('Invalid XML format');
            }

            // Store in local storage
            chrome.storage.local.set({
                'rawXMLCache': xmlContent,
                'xmlLastUpdated': new Date().toISOString()
            }, function() {
                if (chrome.runtime.lastError) {
                    showError('Failed to store XML data');
                    return;
                }

                // Parse and store fields
                const parsedFields = parseXMLFields(xmlDoc);
                if (parsedFields.length > 0) {
                    chrome.storage.local.set({
                        fieldsCache: parsedFields
                    }, function() {
                        if (chrome.runtime.lastError) {
                            showError('Failed to store parsed fields');
                            return;
                        }
                        
                        fields = parsedFields;
                        populateFieldDropdowns(fields);
                        populateParentNodes();
                        updateStatus(`Successfully loaded ${fields.length} fields from XML`);
                    });
                } else {
                    showError('No valid fields found in XML');
                }
            });

        } catch (error) {
            log('Error processing XML:', error);
            showError('Error processing XML: ' + error.message);
        }
    }

    // Add a function to load cached XML content
    function loadCachedXML() {
        chrome.storage.local.get('rawXMLCache', function(data) {
            if (data.rawXMLCache) {
                xmlInput.value = data.rawXMLCache;
                updateStatus('Loaded cached XML content');
            }
        });
    }

    // Load cached XML when popup opens
    loadCachedXML();

    function populateParentNodes() {
        log('Starting populateParentNodes');
        
        chrome.storage.local.get('rawXMLCache', function(data) {
            if (!data.rawXMLCache) {
                log('No XML found in cache');
                parentNodeSelect.innerHTML = '<option value="">No XML data available</option>';
                return;
            }
    
            log('Retrieved XML from cache, parsing...');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data.rawXMLCache, 'text/xml');
            log('XML parsed, root element:', xmlDoc.documentElement.nodeName);
    
            // Find repeating structures
            const repeatingGroups = new Map();
    
            function findRepeatingElements(node, path = '') {
                if (node.nodeType !== 1) return;
    
                // Get all child elements
                const children = Array.from(node.children);
                log(`Checking children of ${path || 'root'}:`, children.map(c => c.nodeName));
                
                // Group children by node name
                const groupedChildren = children.reduce((acc, child) => {
                    const name = child.nodeName;
                    if (!acc[name]) acc[name] = [];
                    acc[name].push(child);
                    return acc;
                }, {});
    
                // Check for repeating structures
                Object.entries(groupedChildren).forEach(([name, nodes]) => {
                    if (nodes.length > 1 && !name.endsWith('_unformatted') && !name.endsWith('_Id')) {
                        const currentPath = path ? `${path}/${name}` : name;
                        log(`Found repeating structure: ${currentPath} with ${nodes.length} instances`);
                        
                        // Check if it has meaningful child elements
                        const hasValidChildren = nodes[0].children.length > 0 &&
                            Array.from(nodes[0].children).some(child => 
                                !child.nodeName.endsWith('_unformatted') && 
                                !child.nodeName.endsWith('_Id'));
                        
                        if (hasValidChildren) {
                            repeatingGroups.set(currentPath, {
                                count: nodes.length,
                                sample: nodes[0],
                                path: `//${currentPath}`
                            });
                            log(`Added to repeating groups: ${currentPath}`);
                        } else {
                            log(`Skipped ${currentPath} - no valid children`);
                        }
                    }
                });
    
                // Recurse through children
                children.forEach(child => {
                    const newPath = path ? `${path}/${child.nodeName}` : child.nodeName;
                    findRepeatingElements(child, newPath);
                });
            }
    
            findRepeatingElements(xmlDoc.documentElement);
            log('Found repeating groups:', Array.from(repeatingGroups.keys()));
            
            // Populate the dropdown
            parentNodeSelect.innerHTML = '<option value="">-- Select Parent Node --</option>';
            
            for (const [path, info] of repeatingGroups) {
                const option = document.createElement('option');
                option.value = info.path;
                const displayName = path.split('/').pop();
                option.textContent = `${displayName} (${info.count} items)`;
                parentNodeSelect.appendChild(option);
                
                log('Added dropdown option:', {
                    path: info.path,
                    display: option.textContent,
                    count: info.count
                });
            }
    
            if (repeatingGroups.size === 0) {
                log('No repeating groups found');
                parentNodeSelect.innerHTML = '<option value="">No repeating structures found</option>';
            }
        });
    }

    function analyzeXMLStructure(xmlContent) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Find repeating structures
        const repeatingGroups = new Map();
        
        function findRepeatingElements(node, path = '') {
            if (node.nodeType !== 1) return;
            
            // Get all child elements
            const children = Array.from(node.children);
            
            // Group children by node name
            const groupedChildren = children.reduce((acc, child) => {
                const name = child.nodeName;
                if (!acc[name]) acc[name] = [];
                acc[name].push(child);
                return acc;
            }, {});
            
            // Check for repeating structures (2 or more identical node names)
            Object.entries(groupedChildren).forEach(([name, nodes]) => {
                if (nodes.length > 1) {
                    const currentPath = path ? `${path}/${name}` : name;
                    repeatingGroups.set(currentPath, {
                        count: nodes.length,
                        sample: nodes[0], // Keep first node as sample for structure
                        path: `//${currentPath}`
                    });
                }
            });
            
            // Recurse through children
            children.forEach(child => {
                const newPath = path ? `${path}/${child.nodeName}` : child.nodeName;
                findRepeatingElements(child, newPath);
            });
        }
        
        findRepeatingElements(xmlDoc.documentElement);
        return repeatingGroups;
    }
    
    function populateParentNodes() {
        // Get the stored XML first
        chrome.storage.local.get('rawXMLCache', function(data) {
            if (!data.rawXMLCache) {
                log('No XML found in cache');
                return;
            }
            
            const repeatingGroups = analyzeXMLStructure(data.rawXMLCache);
            parentNodeSelect.innerHTML = '<option value="">-- Select Parent Node --</option>';
            
            // Add each repeating group to the dropdown
            for (const [path, info] of repeatingGroups) {
                const option = document.createElement('option');
                option.value = info.path;
                // Create a friendly display name
                const displayName = path.split('/').pop();
                option.textContent = `${displayName} (${info.count} items)`;
                parentNodeSelect.appendChild(option);
                
                log('Added repeating group:', {
                    path: info.path,
                    count: info.count,
                    display: option.textContent
                });
            }
        });
    }

    function simplifyPath(path, keepPrefix = true) {
        // Remove common prefixes and clean up the path
        let simplifiedPath = path
            .replace(/^\/\//, '') // Remove leading //
            .replace(/^Params\/TemplateFieldData\/Product_Appendix\/Products_Container\//, '') // Remove specific prefix
            .replace(/^Params\/TemplateFieldData\//, ''); // Remove general prefix
        
        // Add back the // prefix if keepPrefix is true
        return keepPrefix ? `//${simplifiedPath}` : simplifiedPath;
    }
    

    function generateTablePreview(parentNode) {
        log('Starting table preview generation for parent node:', parentNode);
    
        chrome.storage.local.get('rawXMLCache', function(data) {
            if (!data.rawXMLCache) {
                log('No XML found in cache');
                tablePreview.value = 'No XML data found. Please upload an XML file first.';
                return;
            }
    
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data.rawXMLCache, 'text/xml');
            log('XML parsed successfully');
    
            // Remove the leading // and split the path
            const parentPath = parentNode.replace(/^\/\//, '').split('/');
            log('Parent path parts:', parentPath);
    
            let currentElement = xmlDoc.documentElement;
            log('Root element:', currentElement.nodeName);
    
            // Traverse to the parent node
            for (const [index, pathPart] of parentPath.entries()) {
                log(`Looking for path part ${index}:`, pathPart);
                log('Current element children:', Array.from(currentElement.children).map(c => c.nodeName));
                
                currentElement = Array.from(currentElement.children)
                    .find(child => {
                        const match = child.nodeName === pathPart;
                        log(`Checking child ${child.nodeName} against ${pathPart}:`, match);
                        return match;
                    });
    
                if (!currentElement) {
                    log(`Failed to find element at path part: ${pathPart}`);
                    break;
                }
                
                log(`Found element for ${pathPart}:`, currentElement.nodeName);
            }
    
            if (!currentElement) {
                log('Parent node not found in XML');
                tablePreview.value = 'Selected parent node not found in XML structure.';
                return;
            }
    
            // Log the current element's structure
            log('Found parent element:', {
                nodeName: currentElement.nodeName,
                childCount: currentElement.children.length,
                children: Array.from(currentElement.children).map(c => c.nodeName)
            });
    
            // For Products, we want the actual Products elements, not Products_Container
            let repeatingElements = Array.from(currentElement.children)
                .filter(child => {
                    const isRepeating = child.nodeName === parentPath[parentPath.length - 1];
                    log(`Checking if ${child.nodeName} is repeating:`, isRepeating);
                    return isRepeating;
                });
    
            log('Found repeating elements:', repeatingElements.length);
            
            if (repeatingElements.length === 0 && currentElement.nodeName === parentPath[parentPath.length - 1]) {
                // If we're already at the repeating element level, get its siblings
                const parent = currentElement.parentNode;
                if (parent) {
                    repeatingElements = Array.from(parent.children)
                        .filter(child => child.nodeName === currentElement.nodeName);
                    log('Found repeating elements from parent:', repeatingElements.length);
                }
            }
    
            if (repeatingElements.length === 0) {
                log('No repeating elements found');
                tablePreview.value = 'No repeating elements found in selected structure.';
                return;
            }
    
            // Get the first repeating element to analyze its structure
            const firstRepeatingElement = repeatingElements[0];
            log('Analyzing first repeating element:', {
                nodeName: firstRepeatingElement.nodeName,
                childCount: firstRepeatingElement.children.length,
                children: Array.from(firstRepeatingElement.children).map(c => c.nodeName)
            });
    
            // Get all direct child elements that aren't special nodes
            const childNodes = Array.from(firstRepeatingElement.children)
                .filter(child => {
                    const nodeName = child.nodeName;
                    const isValid = !nodeName.endsWith('_unformatted') &&
                                  !nodeName.endsWith('_Id') &&
                                  !nodeName.includes('Container');
                    log(`Checking child node ${nodeName}:`, isValid);
                    return isValid;
                })
                .map(child => ({
                    displayValue: child.nodeName,
                    actualValue: `//${parentNode.replace(/^\/\//, '')}/${child.nodeName}`
                }));
    
            log('Final child nodes:', childNodes);
    
            if (childNodes.length === 0) {
                tablePreview.value = 'No valid child nodes found for the selected parent node.';
                return;
            }
    
            // Sort nodes alphabetically
            childNodes.sort((a, b) => a.displayValue.localeCompare(b.displayValue));
    
            // Generate Word-ready format
            let wordFormat = '=== Word-Ready Format (Copy and use "Convert Text to Table" in Word) ===\n\n';
    
            // Get clean header names and calculate column widths
            const headers = childNodes.map(node => {
                const headerName = node.displayValue;
                return {
                    name: headerName,
                    width: Math.max(headerName.length, 20)
                };
            });
    
            // Add headers row (tab-separated)
            wordFormat += headers.map(h => h.name.padEnd(h.width)).join('\t') + '\n';
    
            // Get the parent node name for the TableRow tag
            const parentNodeName = parentPath[parentPath.length - 1];
    
            // Create the TableRow tag and Content selectors
            const tableRowTag = `<# <TableRow Select="//${parentNodeName}"/> #>`;
            const contentSelectors = childNodes.map(node => {
                const relativePath = node.displayValue;
                return `<# <Content Select="./${relativePath}"/> #>`;
            });
    
            // Combine TableRow tag with first Content selector, then add remaining Content selectors
            const firstColumn = tableRowTag + contentSelectors[0];
            const remainingColumns = contentSelectors.slice(1);
    
            // Build the data row with proper padding
            const dataRow = [
                firstColumn.padEnd(headers[0].width),
                ...remainingColumns.map((selector, index) => 
                    selector.padEnd(headers[index + 1].width)
                )
            ].join('\t');
    
            // Add the data row to the format
            wordFormat += dataRow + '\n\n';
    
            // Add visual preview and documentation
            const previewContent = `=== Visual Preview ===
    
    Table will look like this in Word:
    ${headers.map(h => h.name.padEnd(h.width)).join(' | ')}
    ${headers.map(h => '-'.repeat(h.width)).join('-+-')}
    ${childNodes.map(node => `[${node.displayValue} value]`.padEnd(20)).join(' | ')}
    
    === DocuSign Placeholders Reference ===
    
    TableRow tag (included at start of first cell):
    ${tableRowTag}
    
    Field Selectors:
    ${childNodes.map(node => {
        const relativePath = node.displayValue;
        return `${relativePath}: <# <Content Select="./${relativePath}"/> #>`;
    }).join('\n')}
    
    === Instructions for Word ===
    1. Copy everything between the Word-Ready Format section markers
    2. Paste into Microsoft Word
    3. Select the pasted text
    4. Go to "Insert" > "Table" > "Convert Text to Table"
    5. In the dialog box:
       - Set "Separate text at" to "Tabs"
       - Click OK
    6. The table will be created with proper column formatting
    
    === Notes ===
    - The TableRow tag in the first cell will process each ${parentNodeName} in sequence
    - All fields will be populated for each row automatically
    - Column widths can be adjusted in Word after conversion
    - The TableRow tag must remain in the first cell for proper processing`;
    
            tablePreview.value = wordFormat + previewContent;
            log('Generated Word-friendly preview with TableRow tag and proper tab separation');
        });
    }

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

    

    function addCopyWordFormatButton() {
        const buttonGroup = document.querySelector('.button-group');
        const copyWordButton = document.createElement('button');
        copyWordButton.className = 'secondary-button';
        copyWordButton.textContent = 'Copy Word Format';
        copyWordButton.onclick = function() {
            const previewText = tablePreview.value;
            // Extract just the Word-Ready Format section
            const wordSection = previewText.split('=== Visual Preview ===')[0]
                .replace('=== Word-Ready Format (Copy and use "Convert Text to Table" in Word) ===\n\n', '');
            
            // Copy to clipboard
            navigator.clipboard.writeText(wordSection).then(() => {
                const originalText = copyWordButton.textContent;
                copyWordButton.textContent = 'Copied Word Format!';
                setTimeout(() => {
                    copyWordButton.textContent = originalText;
                }, 1500);
            });
        };
        buttonGroup.appendChild(copyWordButton);
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

    function clearAllCache() {
        console.log('Starting cache clear'); // Debug log
        
        // Update UI first
        const fieldSelect = document.getElementById('field');
        const advancedFieldSelect = document.getElementById('advanced-field');
        const xmlInput = document.getElementById('xmlInput');
        const parentNodeSelect = document.getElementById('parent-node');
        const tablePreview = document.getElementById('table-preview');
        const statusElement = document.getElementById('status');
        
        // Clear dropdowns
        if (fieldSelect) fieldSelect.innerHTML = '<option value="">-- Select Field --</option>';
        if (advancedFieldSelect) advancedFieldSelect.innerHTML = '<option value="">-- Select Field --</option>';
        
        // Clear XML input
        if (xmlInput) xmlInput.value = '';
        
        // Clear parent node select
        if (parentNodeSelect) parentNodeSelect.innerHTML = '<option value="">-- Select Parent Node --</option>';
        
        // Clear table preview
        if (tablePreview) tablePreview.value = '';
        
        // Clear storage
        chrome.storage.local.clear(() => {
            console.log('Storage cleared'); // Debug log
            
            // Reset fields array
            window.fields = [];
            
            // Show status
            if (statusElement) {
                statusElement.textContent = 'Cache cleared successfully';
                statusElement.classList.remove('hidden');
                
                // Hide status after 3 seconds
                setTimeout(() => {
                    statusElement.classList.add('hidden');
                }, 3000);
            }
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
        fields = fieldsData;
        
        [fieldSelect, advancedFieldSelect].forEach(select => {
            select.innerHTML = '';
            select.disabled = false;
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- Select Field --';
            select.appendChild(defaultOption);
            
            // Add fields with values in display
            fieldsData.forEach(field => {
                const option = document.createElement('option');
                option.value = field.actualValue;      // Full path for XPath
                option.textContent = field.displayValue; // //NodeName (value)
                select.appendChild(option);
            });
        });
        
        log('Dropdowns populated with fields:', fieldsData.length);
        updateStatus(`Successfully loaded ${fieldsData.length} fields`);
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
                const selectedField = fieldSelect.value;
                const operator = operatorSelect.value;
                const value = valueInput.value;
    
                if (!selectedField) {
                    showError('Please select a field');
                    return;
                }
    
                // Extract just the node name from the full path
                const nodeName = selectedField.split('/').pop();
                const simpleNodePath = `//${nodeName}`;
    
                switch (operator) {
                    case 'hasValueOf':
                        statement = `<# <Conditional Test="${simpleNodePath}[text() = '${value}']" /> #>`;
                        break;
                    case 'doesNotHaveValueOf':
                        statement = `<# <Conditional Test="not(${simpleNodePath}[text() = '${value}'])" /> #>`;
                        break;
                    case 'hasAnyValue':
                        statement = `<# <Conditional Test="${simpleNodePath}" /> #>`;
                        break;
                    case 'hasNoValue':
                        statement = `<# <Conditional Test="not(${simpleNodePath})" /> #>`;
                        break;
                    case 'multipleValues':
                        const values = value.split(',').map(v => v.trim());
                        statement = `<# <Conditional Test="${simpleNodePath}[${values.map(v => `text() = '${v}'`).join(' or ')}]" /> #>`;
                        break;
                    case 'dateEquals':
                        const formattedDate = value.replace(/[^0-9]/g, '');
                        statement = `<# <Conditional Test="//${nodeName}_unformatted[number(substring-before(translate(text(),'-',''),'T')) = ${formattedDate}]" /> #>`;
                        break;
                    case 'dateNotEquals':
                        const formattedDateNot = value.replace(/[^0-9]/g, '');
                        statement = `<# <Conditional Test="not(//${nodeName}_unformatted[number(substring-before(translate(text(),'-',''),'T')) = ${formattedDateNot}])" /> #>`;
                        break;
                    case 'checkboxChecked':
                        statement = `<# <Conditional Test="${simpleNodePath}/text()" /> #>`;
                        break;
                    case 'checkboxUnchecked':
                        statement = `<# <Conditional Test="not(${simpleNodePath}/text())" /> #>`;
                        break;
                    case 'numericEquals':
                    case 'numericGreaterThan':
                    case 'numericLessThan':
                        const numericValue = parseNumericInput(value);
                        const numericOperator = operator === 'numericEquals' ? '=' : operator === 'numericGreaterThan' ? '>' : '<';
                        statement = `<# <Conditional Test="number(${simpleNodePath}) ${numericOperator} ${numericValue}" /> #>`;
                        break;
                    case 'SuppressListItem':
                        statement = `<# <Conditional Test="${simpleNodePath}[contains(text(), '${value}')]" /> #>`;
                        break;
                    default:
                        throw new Error('Invalid operator selected');
                }
            } else {
                // Advanced tab
                const operatorType = advancedOperatorSelect.value;
                
                if (operatorType === 'tableRow') {
                    const parentNode = parentNodeSelect.value;
                    if (!parentNode) {
                        showError('Please select a parent node');
                        return;
                    }
                    statement = tablePreview.value;
                } else {
                    // Custom XPath
                    const xpath = advancedXPathInput.value.trim();
                    if (!xpath) {
                        showError('Please enter an XPath expression');
                        return;
                    }
                    // For custom XPath, we'll keep whatever the user entered as-is
                    statement = `<# <Conditional Test="${xpath}" /> #>`;
                }
            }
    
            if (statement) {
                outputArea.value = statement;
                log('Generated statement:', statement);
                updateStatus('Statement generated successfully');
    
                // Apply statement if on target page
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
    
        // Validate file type
        if (!file.type && !file.name.endsWith('.xml')) {
            showError('Please select a valid XML file');
            return;
        }
    
        updateStatus('Processing XML file...');
        log('Starting XML upload process for file:', file.name);
    
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const xmlContent = e.target.result;
                log('XML file loaded successfully');
                
                // Validate XML structure first
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
                
                // Check for parsing errors
                const parserError = xmlDoc.getElementsByTagName('parsererror');
                if (parserError.length > 0) {
                    log('XML parsing error:', parserError[0].textContent);
                    showError('Invalid XML format. Please check the file structure.');
                    return;
                }
    
                // Store the raw XML content and metadata
                chrome.storage.local.set({
                    'rawXMLCache': xmlContent,
                    'xmlLastUpdated': new Date().toISOString(),
                    'xmlFileName': file.name
                }, function() {
                    if (chrome.runtime.lastError) {
                        log('Error storing XML:', chrome.runtime.lastError);
                        showError('Failed to store XML data');
                        return;
                    }
                    log('Raw XML stored in cache successfully');
                });
    
                // Find repeating structures for table rows
                const repeatingGroups = analyzeXMLStructure(xmlDoc);
                chrome.storage.local.set({
                    'repeatingStructuresCache': Array.from(repeatingGroups.entries())
                }, function() {
                    log('Repeating structures cached:', repeatingGroups);
                });
    
                // Parse fields
                const parsedFields = parseXMLFields(xmlDoc);
                log('Fields parsed:', parsedFields.length);
                
                if (parsedFields.length > 0) {
                    fields = parsedFields; // Update the global fields array
                    
                    // Store fields in cache
                    chrome.storage.local.set({
                        fieldsCache: fields
                    }, function() {
                        if (chrome.runtime.lastError) {
                            log('Error storing fields:', chrome.runtime.lastError);
                            showError('Failed to store parsed fields');
                            return;
                        }
                        
                        log('Fields stored in cache');
                        populateFieldDropdowns(fields);
                        
                        // Populate parent nodes dropdown for table rows
                        if (repeatingGroups.size > 0) {
                            populateParentNodes();
                        }
                        
                        updateStatus(`Successfully loaded ${fields.length} fields and ${repeatingGroups.size} repeating structures from XML`);
                    });
                } else {
                    showError('No valid fields found in XML');
                }
    
            } catch (error) {
                log('Error processing XML:', error);
                showError('Error processing XML: ' + error.message);
            }
        };
    
        reader.onerror = function(error) {
            log('File reading error:', error);
            showError('Error reading file: ' + (error.message || 'Unknown error'));
        };
    
        reader.onprogress = function(event) {
            if (event.lengthComputable) {
                const percentLoaded = Math.round((event.loaded / event.total) * 100);
                updateStatus(`Loading XML file: ${percentLoaded}%`);
            }
        };
    
        // Start reading the file
        try {
            reader.readAsText(file);
            log('Started reading XML file');
        } catch (error) {
            log('Error initiating file read:', error);
            showError('Failed to read file: ' + error.message);
        }
    }

    function parseXMLFields(xmlDoc) {
        let allFields = [];
        
        function traverseXML(node, parentPath = '') {
            if (node.nodeType === 3 || node.nodeType === 4) return;
            
            if (node.nodeType === 1) { // Element node
                const nodeName = node.nodeName;
                
                // Get the node's text value
                let nodeValue = Array.from(node.childNodes)
                    .filter(child => child.nodeType === 3)
                    .map(child => child.textContent.trim())
                    .join('')
                    .trim();
                
                // Get CDATA if no direct text
                if (!nodeValue) {
                    nodeValue = Array.from(node.childNodes)
                        .filter(child => child.nodeType === 4)
                        .map(child => child.textContent.trim())
                        .join('')
                        .trim();
                }
                
                // Check for key attribute
                const keyAttribute = node.getAttribute('key');
                if (keyAttribute) {
                    nodeValue = keyAttribute;
                }
                
                // Build the full path
                const fullPath = parentPath ? `${parentPath}/${nodeName}` : nodeName;
                
                // Only include nodes that have a value and aren't special nodes
                if (nodeValue && 
                    !nodeName.endsWith('_unformatted') && 
                    !nodeName.endsWith('_Id') &&
                    !nodeValue.includes('CDATA')) {
                    
                    // Create display value with the node value in brackets
                    const displayWithValue = nodeValue.length > 50 
                        ? `//${nodeName} (${nodeValue.substring(0, 47)}...)`  // Truncate long values
                        : `//${nodeName} (${nodeValue})`;
                    
                    allFields.push({
                        displayValue: displayWithValue,  // Node name with value in brackets
                        actualValue: `//${fullPath}`,    // Full path for XPath
                        nodeValue: nodeValue
                    });
                    
                    log('Added field:', {
                        display: displayWithValue,
                        path: `//${fullPath}`,
                        value: nodeValue
                    });
                }
                
                // Process child nodes
                Array.from(node.children).forEach(child => {
                    traverseXML(child, fullPath);
                });
            }
        }
        
        traverseXML(xmlDoc.documentElement);
        
        // Sort fields alphabetically by the base node name (without the value in brackets)
        allFields.sort((a, b) => {
            const aName = a.displayValue.split(' (')[0];
            const bName = b.displayValue.split(' (')[0];
            return aName.toLowerCase().localeCompare(bName.toLowerCase());
        });
        
        return allFields;
    }

    function isContainerNode(field) {
        return field.actualValue.includes('Container') ||
               field.actualValue.includes('_r') ||
               field.actualValue.endsWith('s') || // Common plural endings indicating collections
               field.hasChildren === true ||
               // Check if the node has any child nodes in our fields array
               fields.some(otherField => 
                   otherField.actualValue !== field.actualValue &&
                   otherField.actualValue.startsWith(field.actualValue + '/')
               );
    }
});

console.log('Popup script finished loading');
