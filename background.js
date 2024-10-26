// Set up logging
const DEBUG = true;
function log(...args) {
    if (DEBUG) console.log('[CLM Extension Background]:', ...args);
}

// Handle file upload
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "uploadXML") {
        log('Received upload request');
        handleFileUpload(request.fileData)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
    }
});

// Handle ChromeOS file browser
chrome.fileBrowserHandler.onExecute.addListener((id, details) => {
    if (id === 'upload_xml') {
        details.entries.forEach(entry => {
            entry.file(file => {
                processXMLFile(file);
            });
        });
    }
});

async function handleFileUpload(fileData) {
    log('Processing file upload');
    try {
        // Parse XML content
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileData, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length > 0) {
            throw new Error('Invalid XML format');
        }

        // Store in local storage
        await chrome.storage.local.set({
            'rawXMLCache': fileData,
            'xmlLastUpdated': new Date().toISOString()
        });

        // Parse fields
        const fields = parseXMLFields(xmlDoc);
        await chrome.storage.local.set({ fieldsCache: fields });

        return { fields, message: 'File processed successfully' };
    } catch (error) {
        log('Error processing file:', error);
        throw error;
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

// Initialize
log('Background script initialized');