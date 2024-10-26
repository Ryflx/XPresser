# Blueprint Documentation

## Project Summary

This project is a Chrome extension designed to interact with web pages, allowing users to generate and apply conditional statements based on fields found on the page. The extension consists of a popup script (`popup.js`) and a content script (`content.js`).

### Popup Script (`popup.js`)

The popup script initializes a user interface for selecting fields, operators, and values to generate conditional statements. It includes debugging capabilities and interacts with the content script to fetch fields and apply statements. The script now includes a timeout mechanism to clear the "Loading fields..." message after a short period if fields are not loaded successfully.

### Content Script (`content.js`)

The content script listens for messages from the popup and performs actions such as fetching fields from the page and applying generated statements. It includes mechanisms to handle asynchronous operations and ensure compatibility with the target page. The script now features improved field extraction methods, enhanced error handling, and a retry mechanism for more reliable field retrieval.

## Change Log

- **Initial Version**: Implemented basic functionality for generating and applying conditional statements.
- **Debugging Added**: Introduced logging for both popup and content scripts to aid in development and troubleshooting.
- **Cache Feature**: Added functionality to load fields from a local cache to improve performance and user experience.
- **Cache Clearing Functionality**: Implemented a feature to clear the local cache, allowing users to reset stored data and ensure fresh data retrieval.
- **Load own XML Functionality**: Implemented a feature to upload an .xml or .txt file, read its contents and populate the 'Field' dropdown and populate the nodes inner value into the 'Value' text field.
- **Improved Field Extraction**: Enhanced the field extraction process in content.js to be more robust and reliable. Added a retry mechanism and more detailed logging for better diagnostics.
- **Loading Message Timeout**: Added a timeout mechanism in popup.js to clear the "Loading fields..." message after a short period if fields are not loaded successfully, improving user experience.
- **Handling Comma-separated Numbers**: Updated the generateStatement function to handle comma-separated numbers and other string inputs in the Value text box. This allows for more flexible input formats, especially for numeric fields.
- **TableRow Feature (23-10-2024)**: Added functionality to generate dynamic table structures:
  - Added TableRow option in the advanced tab
  - Implemented parent node selection for container elements
  - Added table preview functionality
  - Generates table structure with proper template syntax for dynamic data
  - Updated UI to toggle between custom XPath and TableRow sections

## Notes

- Ensure that the target page has a textarea matching one of the selectors used in `applyStatement`.
- Verify that the script is running on the correct URL (`springcm.com/atlas/Admin/FormConfig`).
- The field extraction process now attempts multiple methods to retrieve fields, improving reliability across different page structures.
- The popup now provides better feedback to the user when field loading is delayed or unsuccessful.
- The Value text box now accepts comma-separated numbers, which are automatically parsed and handled correctly for numeric operations.
- When using the TableRow feature, select container nodes as parent nodes to generate proper table structures.

## Future Updates

- Snip Dropdown field value so it only has the nodename of the XML e.g. //Account_Name not //Account_Name (Edge Bank UK)
- Consider implementing a more sophisticated caching mechanism that takes into account potential changes in the webpage structure.
- Explore ways to further optimize field loading and improve performance on slower connections or complex pages.
- Enhance error handling and user feedback for various input formats in the Value text box.
- Consider adding support for more complex numeric operations and comparisons.
- Consider adding customization options for table structures (column headers, styling)
