# Documentation for `index_script_1.js`

This document provides a detailed explanation of every function and its parameters found within the `index_script_1.js` file for the Amortizer application.

## Core Data & Utilities

### `hydrate(data)`
Reconstructs JavaScript `Date` objects from their string representations when loading the JSON data from `localStorage`.
*   **`data`**: `Object` - The parsed JSON object representing the entire borrower database. Returns the hydrated object.

### `updateTimestamp(action)`
Updates the UI labels to reflect the latest action performed, displaying the current date and time. Also briefly flashes a "Changes Saved" notice.
*   **`action`**: `String` - A short description of the action taken (e.g., 'Export', 'Import', 'Clear').

### `save()`
Serializes the `db` (database) object into JSON and stores it in the browser's `localStorage` under the key `borrower_db`. Also updates the UI to show an "Auto-saved" indicator.
*   **Parameters**: None.

### `clearAllData()`
Permanently deletes all borrower data from memory and `localStorage` after prompting the user for confirmation.
*   **Parameters**: None.

## UI Display & Modal Logic

### `openDoc()`
Displays the document modal by changing its CSS display property to 'flex' and prevents the main body from scrolling.
*   **Parameters**: None.

### `closeDoc()`
Hides the document modal by changing its CSS display property to 'none' and restores the main body's scrollability.
*   **Parameters**: None.

### `updateDisplay()`
The core rendering function. Shows/hides the main content area based on whether there's an active borrower. Calculates all the amortization schedules, fiscal liabilities, and populates the data tables, summary stats, and fiscal tables on the dashboard. Also prepares the `exportData` object.
*   **Parameters**: None.

### `renderTabs()`
Renders the navigation tabs at the top of the interface for switching between different borrowers.
*   **Parameters**: None.

### `renderEMITable(schedule)`
Generates the HTML rows for the detailed Amortization Schedule table based on the provided schedule array.
*   **`schedule`**: `Array` - A list of objects containing details for each payment (date, name, opening balance, interest, principal, total payment).

## File Import / Export

### `exportToJson()`
Downloads the current state of the database (`db`) as a formatted JSON file.
*   **Parameters**: None.

### `importFromJson(event)`
Reads an uploaded JSON file, parses it, and replaces the current browser database. It asks for user confirmation before overwriting data.
*   **`event`**: `Event` - The file input change event object that contains the selected file.

### `createXMLWorkbook(sheets)`
Generates an XML string compatible with Microsoft Excel (XML Spreadsheet 2003 format). Defines styles and maps sheet data into rows and cells.
*   **`sheets`**: `Array` - A list of objects representing individual worksheets. Each object must have a `name` and a `data` array (containing rows of column-value pairs).

### `exportToExcel()`
Prepares the data for three sheets (Active Loans, Fiscal Analysis, Amortization Schedule) from the `exportData` object and initiates a download of an `.xls` file using the output of `createXMLWorkbook()`.
*   **Parameters**: None.

## Borrower Management

### `addBorrower()`
Reads the input field for a new borrower's name, creates a new entry in the database (if it doesn't already exist), saves the state, and switches the view to the new borrower.
*   **Parameters**: None.

### `selectBorrower(name)`
Sets the `activeBorrower` variable to the specified name and triggers a UI update.
*   **`name`**: `String` - The identifier (name) of the borrower to make active.

### `deleteCurrentBorrower()`
Prompts for confirmation and deletes all data associated with the currently active borrower, then switches to another available borrower (or none).
*   **Parameters**: None.

## Loan Calculations & Management

### `toggleCalcMode()`
Toggles the input form between 'ROI mode' (inputting an interest rate) and 'EMI mode' (inputting a target installment to calculate the required interest rate).
*   **Parameters**: None.

### `calculateROI(principal, tenure, moratorium, moraType, targetEMI)`
Uses a binary search algorithm to find the monthly Rate of Interest (ROI) that results in the specified target EMI, considering the principal, entire tenure, and the moratorium phase logic.
*   **`principal`**: `Number` - The initial loan amount.
*   **`tenure`**: `Number` - Total duration of the loan in months (including moratorium).
*   **`moratorium`**: `Number` - The number of initial months where regular EMI isn't paid.
*   **`moraType`**: `String` - Handling of moratorium ('noPayment' means interest compounds; otherwise, it's simple interest paid monthly).
*   **`targetEMI`**: `Number` - The desired monthly payment amount.
*   Returns: `Number` - The calculated monthly rate of interest (as a decimal, e.g., 0.01 for 1%).

### `addLoan()`
Reads data from the loan form. If in EMI calculation mode, it invokes `calculateROI`. Validates the inputs, constructs a loan object, and adds it to the active borrower's portfolio (or updates an existing loan if in edit mode), then saves and updates the UI.
*   **Parameters**: None.

### `deleteLoan(loanId)`
Prompts for confirmation, removes a specific loan from the active borrower's portfolio by its ID, saves the changes, and updates the display.
*   **`loanId`**: `Number` - The unique ID of the loan to remove.

### `resetForm()`
Clears the input fields in the loan entry/edit form, resting them to default blank or zero states.
*   **Parameters**: None.

### `editLoan(id)`
Populates the loan input form with the details of an existing loan, allowing the user to modify it. Changes the "Add Loan" button to an "Update Loan" button and displays a "Cancel" option.
*   **`id`**: `Number` - The unique ID of the loan to edit.

### `cancelEdit()`
Resets the loan form, clears the `editingLoanId` state, and returns the form buttons to their standard "Add" functionality.
*   **Parameters**: None.

### `toggleLoanSelection(id, isSelected)`
Toggles the inclusion of a specific loan within the combined calculations and updates the display immediately.
*   **`id`**: `Number` - The unique ID of the loan.
*   **`isSelected`**: `Boolean` - Whether the loan's checkbox is checked.

### `toggleAllLoans(sourceCheckbox)`
Sets the selection state of all loans for the active borrower to match the state of the provided "Select All" checkbox.
*   **`sourceCheckbox`**: `HTMLInputElement` - The DOM element representing the 'Select All' checkbox.

## Date & Fiscal Helpers

### `getFY(date)`
Determines the Indian Fiscal Year string (e.g., "2023-24") for a given date. Financial year starts April 1st.
*   **`date`**: `Date|String` - The date to evaluate.
*   Returns: `String` - Format "YYYY-YY".

### `getFYEndDate(fyString)`
Calculates the absolute end Date object for a given fiscal year string (ending on March 31st).
*   **`fyString`**: `String` - Format "YYYY-YY" (e.g., "2023-24").
*   Returns: `Date` - Always sets to March 31st of the appropriate ending year.

### `monthDiff(d1, d2)`
Calculates the span of full calendar months between two given dates.
*   **`d1`**: `Date` - The start date.
*   **`d2`**: `Date` - The end date.
*   Returns: `Number` - The difference in months (0 if d2 is before d1).
