// Data hydration (fix Date strings)
function hydrate(data) {
    if (!data) return {};
    Object.keys(data).forEach(borrower => {
        if (Array.isArray(data[borrower])) {
            data[borrower].forEach(l => {
                l.dDate = new Date(l.dDate);
                if (l.fDate) l.fDate = new Date(l.fDate);
            });
        }
    });
    return data;
}

// Initial data load
let db = hydrate(JSON.parse(localStorage.getItem('borrower_db'))) || {};
let activeBorrower = null;
let editingLoanId = null;
let exportData = null; // Store calculated data for export

// --- Modal Logic ---
function openDoc() {
    document.getElementById('docModal').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scroll
}

function closeDoc() {
    document.getElementById('docModal').style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scroll
}

// --- Time Stamp Logic ---
function updateTimestamp(action) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString([], { day: '2-digit', month: 'short' });

    document.getElementById('lastActionLabel').innerText = `Last : ${action}`;
    document.getElementById('timestamp').innerText = `${dateStr}, ${timeStr}`;

    const status = document.getElementById('syncStatus');
    status.innerText = "Changes Saved";
    status.style.display = "inline-block";
    setTimeout(() => { status.style.opacity = "0.5"; }, 2000);
}

// --- FILE IMPORT/EXPORT LOGIC ---
function exportToJson() {
    if (Object.keys(db).length === 0) {
        alert("No data to export!");
        return;
    }
    const dataStr = JSON.stringify(db, null, 4);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `amortizer_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    linkElement.click();
    updateTimestamp('Export');
}

function createXMLWorkbook(sheets) {
    let xml = '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';

    // Styles
    xml += ' <Styles>\n';
    xml += '  <Style ss:ID="Default" ss:Name="Normal">\n';
    xml += '   <Alignment ss:Vertical="Bottom"/>\n';
    xml += '   <Borders/>\n';
    xml += '   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>\n';
    xml += '   <Interior/>\n';
    xml += '   <NumberFormat/>\n';
    xml += '   <Protection/>\n';
    xml += '  </Style>\n';
    xml += '  <Style ss:ID="sHeader">\n';
    xml += '   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>\n';
    xml += '  </Style>\n';
    xml += ' </Styles>\n';

    sheets.forEach(sheet => {
        xml += ` <Worksheet ss:Name="${sheet.name}">\n`;
        xml += '  <Table>\n';

        // Header Row
        if (sheet.data.length > 0) {
            xml += '   <Row>\n';
            Object.keys(sheet.data[0]).forEach(key => {
                xml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${key}</Data></Cell>\n`;
            });
            xml += '   </Row>\n';
        }

        // Data Rows
        sheet.data.forEach(row => {
            xml += '   <Row>\n';
            Object.values(row).forEach(val => {
                const type = typeof val === 'number' ? 'Number' : 'String';
                xml += `    <Cell><Data ss:Type="${type}">${val}</Data></Cell>\n`;
            });
            xml += '   </Row>\n';
        });

        xml += '  </Table>\n';
        xml += ' </Worksheet>\n';
    });

    xml += '</Workbook>';
    return xml;
}

function exportToExcel() {
    if (!exportData || !activeBorrower) return alert("No data to export");

    // 1. Prepare Active Loans Sheet
    const loansSheetData = exportData.loans.map(l => ({
        "Loan Name": l.name,
        "Principal": l.p,
        "ROI (%)": parseFloat((l.r * 12 * 100).toFixed(2)),
        "Tenure (Mo)": l.t,
        "Moratorium (Mo)": l.moraMonths || 0,
        "Start Date": l.dDate.toLocaleDateString('en-IN')
    }));

    // 2. Prepare Fiscal Analysis Sheet
    const fiscalSheetData = exportData.fiscal.map(f => ({
        "Fiscal Year": f.fy,
        "Opening Balance": Math.round(f.open),
        "Interest Paid": Math.round(f.int),
        "Principal Paid": Math.round(f.prin),
        "Closing Balance": Math.round(f.close),
        "Current Liability": Math.round(f.curr),
        "Long Term Liability": Math.round(f.long)
    }));

    // 3. Prepare Amortization Schedule Sheet
    const scheduleSheetData = exportData.schedule.map((s, i) => ({
        "#": i + 1,
        "Date": new Date(s.date).toLocaleDateString('en-IN'),
        "Loan Name": s.name,
        "Opening Balance": Math.round(s.open),
        "Total Payment": Math.round(s.total),
        "Interest Component": Math.round(s.int),
        "Principal Component": Math.round(s.prin),
        "Closing Balance": Math.round(s.open - s.prin)
    }));

    const sheets = [];
    if (loansSheetData.length > 0) sheets.push({ name: "Active Loans", data: loansSheetData });
    if (fiscalSheetData.length > 0) sheets.push({ name: "Fiscal Analysis", data: fiscalSheetData });
    if (scheduleSheetData.length > 0) sheets.push({ name: "Amortization Schedule", data: scheduleSheetData });

    const xmlContent = createXMLWorkbook(sheets);
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Amortizer_Report_${activeBorrower}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    updateTimestamp('Export Excel');
}

function importFromJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedDb = JSON.parse(e.target.result);
            if (confirm("This will replace your current browser data with the imported file. Continue?")) {
                db = hydrate(importedDb);
                save();
                activeBorrower = Object.keys(db)[0] || null;
                updateDisplay();
                updateTimestamp('Import');
                alert("Import Successful!");
                event.target.value = '';
            }
        } catch (err) {
            alert("Error reading JSON file.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function addBorrower() {
    const name = document.getElementById('newBorrowerName').value.trim();
    if (name && !db[name]) {
        db[name] = [];
        save();
        selectBorrower(name);
        document.getElementById('newBorrowerName').value = '';
    }
}

function selectBorrower(name) {
    activeBorrower = name;
    updateDisplay();
}

function deleteCurrentBorrower() {
    if (confirm(`Delete all data for ${activeBorrower}?`)) {
        delete db[activeBorrower];
        activeBorrower = Object.keys(db)[0] || null;
        save();
        updateDisplay();
    }
}

function toggleCalcMode() {
    const mode = document.querySelector('input[name="calcMode"]:checked').value;
    const roiGroup = document.getElementById('roiInputGroup');
    const emiGroup = document.getElementById('emiInputGroup');
    const nonEmiCheckbox = document.getElementById('isNonEmi');

    if (mode === 'roi') {
        roiGroup.style.display = 'flex';
        emiGroup.style.display = 'none';
        if (nonEmiCheckbox) nonEmiCheckbox.disabled = false;
    } else {
        roiGroup.style.display = 'none';
        emiGroup.style.display = 'flex';
        if (nonEmiCheckbox) {
            nonEmiCheckbox.checked = false; // Uncheck it
            nonEmiCheckbox.disabled = true;  // Disable it
        }
    }
}

function calculateROI(principal, tenure, moratorium, moraType, targetEMI) {
    // Binary search for monthly ROI
    let low = 0.0000001; // Approx 0%
    let high = 1.0; // 100% per month
    let tolerance = 0.0000001;
    let foundR = 0;

    const repayTenure = tenure - moratorium;
    if (repayTenure <= 0) return 0;

    for (let i = 0; i < 100; i++) {
        let mid = (low + high) / 2;
        let r = mid;

        // Calculate Effective Principal
        let effectivePrincipal = principal;
        if (moraType === 'noPayment') {
            // Compound for moratorium period
            effectivePrincipal = principal * Math.pow(1 + r, moratorium);
        }

        // Calculate EMI for this r
        let emi = 0;
        // Avoid division by zero
        if (Math.pow(1 + r, repayTenure) - 1 === 0) {
            emi = effectivePrincipal / repayTenure;
        } else {
            emi = (effectivePrincipal * r * Math.pow(1 + r, repayTenure)) / (Math.pow(1 + r, repayTenure) - 1);
        }

        if (Math.abs(emi - targetEMI) < tolerance) {
            foundR = mid;
            break;
        } else if (emi < targetEMI) {
            low = mid;
        } else {
            high = mid;
        }
        foundR = mid;
    }
    return foundR;
}

function addLoan() {
    const calcMode = document.querySelector('input[name="calcMode"]:checked').value;

    let roiVal = 0;
    // Common values
    const p = parseFloat(document.getElementById('p').value);
    const t = parseInt(document.getElementById('t').value);
    const moraMonths = parseInt(document.getElementById('moraMonths').value) || 0;
    const mType = document.getElementById('mType').value;

    if (calcMode === 'roi') {
        roiVal = parseFloat(document.getElementById('r').value) / 12 / 100;
    } else {
        const targetEMI = parseFloat(document.getElementById('targetEMI').value);
        if (!p || !t || !targetEMI) return alert("Please enter Principal, Tenure and EMI amount.");
        if (document.getElementById('isNonEmi').checked) return alert("Target EMI calculation is not mathematically compatible with Non-EMI (Straight-Line) loans.");

        // Calculate ROI
        roiVal = calculateROI(p, t, moraMonths, mType, targetEMI);

        // Update the visible ROI field to reflect the calculated value (for user feedback)
        document.getElementById('r').value = (roiVal * 12 * 100).toFixed(2);
    }

    const l = {
        id: editingLoanId || Date.now(),
        name: document.getElementById('lName').value || 'Term Loan',
        p: p,
        r: roiVal,
        t: t,
        moraMonths: moraMonths,
        mType: mType,
        dDate: new Date(document.getElementById('dDate').value),
        isNonEmi: document.getElementById('isNonEmi').checked,
    };
    if (editingLoanId) {
        const existing = db[activeBorrower].find(x => x.id === editingLoanId);
        l.selected = existing ? existing.selected : true;
    } else {
        l.selected = true;
    }

    if (!l.p || isNaN(l.t) || l.t <= 0 || isNaN(l.r) || isNaN(l.dDate.getTime())) {
        return alert("Please fill all details correctly.");
    }

    if (editingLoanId) {
        const idx = db[activeBorrower].findIndex(x => x.id === editingLoanId);
        if (idx !== -1) db[activeBorrower][idx] = l;
        cancelEdit();
    } else {
        db[activeBorrower].push(l);
        resetForm();
    }
    save();
    updateDisplay();
}

function deleteLoan(loanId) {
    if (confirm("Remove this loan from the portfolio?")) {
        db[activeBorrower] = db[activeBorrower].filter(loan => loan.id !== loanId);
        save();
        updateDisplay();
    }
}

function resetForm() {
    document.getElementById('lName').value = '';
    document.getElementById('p').value = '';
    document.getElementById('moraMonths').value = '0';
    document.getElementById('isNonEmi').checked = false;
}

function editLoan(id) {
    const l = db[activeBorrower].find(x => x.id === id);
    if (!l) return;

    editingLoanId = id;
    document.getElementById('lName').value = l.name;
    document.getElementById('p').value = l.p;
    document.getElementById('r').value = (l.r * 12 * 100).toFixed(2);
    document.getElementById('t').value = l.t;
    document.getElementById('moraMonths').value = l.moraMonths !== undefined ? l.moraMonths : (l.fDate ? monthDiff(new Date(l.dDate), new Date(l.fDate)) : 0);
    document.getElementById('mType').value = l.mType;
    document.getElementById('dDate').value = l.dDate.toISOString().split('T')[0];
    document.getElementById('isNonEmi').checked = l.isNonEmi;

    const btn = document.querySelector('button[onclick="addLoan()"]');
    btn.innerText = "Update Loan";
    btn.style.background = "#f59e0b";

    let cancelBtn = document.getElementById('cancelEditBtn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.innerText = "Cancel";
        cancelBtn.className = "secondary";
        cancelBtn.onclick = cancelEdit;
        cancelBtn.style.flex = "1";
        btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
    } else {
        cancelBtn.style.display = "inline-block";
    }
    document.querySelector('.section-header').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    editingLoanId = null;
    resetForm();
    const btn = document.querySelector('button[onclick="addLoan()"]');
    btn.innerText = "Add Loan";
    btn.style.background = "var(--primary)";
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = "none";
}

function toggleLoanSelection(id, isSelected) {
    const loan = db[activeBorrower].find(l => l.id === id);
    if (loan) {
        loan.selected = isSelected;
        save();
        updateDisplay();
    }
}

function toggleAllLoans(sourceCheckbox) {
    db[activeBorrower].forEach(l => l.selected = sourceCheckbox.checked);
    save();
    updateDisplay();
}

function getFY(date) {
    const d = new Date(date);
    let y = d.getFullYear();
    return d.getMonth() >= 3 ? `${y}-${(y + 1).toString().slice(-2)}` : `${y - 1}-${y.toString().slice(-2)}`;
}

function getFYEndDate(fyString) {
    const year = 2000 + parseInt(fyString.split('-')[1]);
    return new Date(year, 2, 31);
}

function monthDiff(d1, d2) {
    let months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 0 : months;
}

// Safely calculate a future payment date from a fixed start date without backward drift
function getPaymentDate(startDate, monthIndex) {
    const d = new Date(startDate);
    const expectedMonth = (d.getMonth() + monthIndex) % 12;
    // Let JavaScript safely advance BOTH the year and the month via raw numbers alone
    const newDate = new Date(d.getFullYear(), d.getMonth() + monthIndex, d.getDate());

    // If rollover occurs (e.g. Feb 31 -> Mar 3), newDate's month will overshoot perfectly.
    // We seamlessly cap it precisely back to the last day of the expected month.
    if (newDate.getMonth() !== expectedMonth) {
        newDate.setDate(0);
    }
    return newDate;
}

function updateDisplay() {
    renderTabs();
    if (!activeBorrower) {
        document.getElementById('mainContent').style.display = 'none';
        return;
    }
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('activeBorrowerTitle').innerText = activeBorrower;

    const loans = db[activeBorrower];
    // Ensure legacy data has 'selected' property
    let allSelected = true;
    loans.forEach(l => {
        if (l.selected === undefined) l.selected = true;
        if (!l.selected) allSelected = false;
    });

    const calculatedLoans = loans.filter(l => l.selected !== false);

    let allLoanSchedules = [];
    const filterSelect = document.getElementById('loanFilter');
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">All Loans Combined</option>';
    calculatedLoans.forEach(l => {
        filterSelect.innerHTML += `<option value="${l.id}" ${currentFilter == l.id ? 'selected' : ''}>${l.name}</option>`;
    });

    calculatedLoans.forEach(loan => {
        let bal = loan.p;

        // Determine effective moratorium months (handle legacy data)
        let effectiveMoraMonths = loan.moraMonths;
        if (effectiveMoraMonths === undefined && loan.fDate) {
            effectiveMoraMonths = monthDiff(new Date(loan.dDate), new Date(loan.fDate));
        }
        effectiveMoraMonths = effectiveMoraMonths || 0;

        // Repayment tenure = Total Tenure - Moratorium
        let repaymentTenure = loan.t - effectiveMoraMonths;
        if (repaymentTenure <= 0) repaymentTenure = 1;

        let monthOffset = 0;

        // Moratorium Phase
        for (let m = 0; m < effectiveMoraMonths; m++) {
            let pDate = getPaymentDate(loan.dDate, monthOffset);
            let mInt = bal * loan.r;
            let pPaid = 0;
            let payment = loan.mType === 'noPayment' ? 0 : mInt;
            allLoanSchedules.push({ id: loan.id, date: pDate, name: loan.name, int: mInt, prin: pPaid, open: bal, total: payment });
            if (loan.mType === 'noPayment') bal += mInt;
            monthOffset++;
        }

        if (loan.isNonEmi) {
            let fixedPrincipal = bal / repaymentTenure;
            for (let i = 0; i < repaymentTenure; i++) {
                let pDate = getPaymentDate(loan.dDate, monthOffset);
                let interest = bal * loan.r;

                // On the very last payment, force principal to absorb trailing decimals
                if (i === repaymentTenure - 1) {
                    fixedPrincipal = bal;
                }

                let totalPayment = fixedPrincipal + interest;
                allLoanSchedules.push({ id: loan.id, date: pDate, name: loan.name, int: interest, prin: fixedPrincipal, open: bal, total: totalPayment });
                bal -= fixedPrincipal;
                monthOffset++;
            }
        } else {
            let emi;
            if (loan.r === 0) {
                // Handle 0% interest case to prevent division by zero
                emi = bal / repaymentTenure;
            } else {
                // Standard EMI formula
                emi = (bal * loan.r * Math.pow(1 + loan.r, repaymentTenure)) / (Math.pow(1 + loan.r, repaymentTenure) - 1);
            }

            for (let i = 0; i < repaymentTenure; i++) {
                let pDate = getPaymentDate(loan.dDate, monthOffset);
                let interest = bal * loan.r;
                let principal = emi - interest;

                // On the final payment, force the principal to exactly equal the remaining balance 
                // to absorb any floating-point decimal compounding errors and forcefully zero it out.
                if (i === repaymentTenure - 1) {
                    principal = bal;
                    emi = principal + interest;
                }

                allLoanSchedules.push({ id: loan.id, date: pDate, name: loan.name, int: interest, prin: principal, open: bal, total: emi });
                bal -= principal;
                monthOffset++;
            }
        }
    });

    const loanListBody = document.getElementById('loanListBody');
    loanListBody.innerHTML = loans.map(l => {
        const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };

        // Calculation check for display
        let effectiveMoraMonths = l.moraMonths;
        if (effectiveMoraMonths === undefined && l.fDate) {
            effectiveMoraMonths = monthDiff(new Date(l.dDate), new Date(l.fDate));
        }
        effectiveMoraMonths = effectiveMoraMonths || 0;

        let repaymentTenure = l.t - effectiveMoraMonths;
        if (repaymentTenure <= 0) repaymentTenure = 1;

        // Calculate first EMI Date specifically for display
        let fDateCalc = getPaymentDate(l.dDate, effectiveMoraMonths);
        const fFormatted = fDateCalc.toLocaleDateString('en-IN', dateOptions);

        // Simulation for correct EMI display
        let tempBal = l.p;
        if (l.mType === 'noPayment') {
            for (let k = 0; k < effectiveMoraMonths; k++) { tempBal += tempBal * l.r; }
        }

        let monthlyPayment;
        if (l.isNonEmi) {
            monthlyPayment = tempBal / repaymentTenure;
        } else if (l.r === 0) {
            monthlyPayment = tempBal / repaymentTenure;
        } else {
            monthlyPayment = (tempBal * l.r * Math.pow(1 + l.r, repaymentTenure)) / (Math.pow(1 + l.r, repaymentTenure) - 1);
        }

        return `<tr>
                <td style="text-align: center;"><input type="checkbox" ${l.selected !== false ? 'checked' : ''} onclick="toggleLoanSelection(${l.id}, this.checked)"></td>
                <td style="text-align: left;">${l.name}</td>
                <td style="text-align: center;">${fFormatted}</td>
                <td style="text-align: center;">₹${l.p.toLocaleString()}</td>
                <td style="text-align: center;">${(l.r * 12 * 100).toFixed(2)}%</td>
                <td style="text-align: center;">${l.t} Mo</td>
                <td style="text-align: center;">${effectiveMoraMonths} Mo</td>
                <td style="text-align: center;">₹${Math.round(monthlyPayment).toLocaleString()}${l.isNonEmi ? ' + Int' : ''}</td>
                <td>
                    <button class="edit-btn" onclick="editLoan(${l.id})">Edit</button>
                    <button class="danger" onclick="deleteLoan(${l.id})">Remove</button>
                </td>
            </tr>`;
    }).join('');

    // Dashboard Calculation
    const today = new Date();
    let nextMonthLiability = 0;
    let totalCurrentOutstanding = 0;

    calculatedLoans.forEach(l => {
        const sched = allLoanSchedules.filter(s => s.id === l.id);
        if (sched.length === 0) {
            totalCurrentOutstanding += l.p;
            return;
        }
        const nextPayment = sched.find(s => s.date > today);
        if (nextPayment) {
            nextMonthLiability += nextPayment.total;
            totalCurrentOutstanding += nextPayment.open;
        }
    });

    document.getElementById('statTotalBal').innerText = '₹' + Math.round(totalCurrentOutstanding).toLocaleString();
    document.getElementById('statMonthly').innerText = '₹' + Math.round(nextMonthLiability).toLocaleString();
    document.getElementById('statCount').innerText = calculatedLoans.length;

    const selectAllBox = document.getElementById('selectAllBox');
    if (selectAllBox) {
        selectAllBox.checked = allSelected && loans.length > 0;
        selectAllBox.indeterminate = !allSelected && loans.some(l => l.selected);
    }

    const fyList = [...new Set(allLoanSchedules.map(s => getFY(s.date)))].sort();
    const fiscalBody = document.getElementById('fiscalBody');
    fiscalBody.innerHTML = '';

    // Create lookup for efficiency
    const loanStartDates = new Map(calculatedLoans.map(l => [l.id, l.dDate]));

    fyList.forEach(fy => {
        const paymentsInFY = allLoanSchedules.filter(s => getFY(s.date) === fy);
        const openingBal = calculatedLoans.reduce((sum, loan) => {
            const firstPayment = paymentsInFY.find(p => p.id === loan.id);
            return sum + (firstPayment ? firstPayment.open : 0);
        }, 0);
        const intPaid = paymentsInFY.reduce((sum, s) => sum + s.int, 0);
        const prinPaid = paymentsInFY.reduce((sum, s) => sum + s.prin, 0);

        // Add capitalized interest to closing balance (interest charged but not paid)
        const capitalizedInt = paymentsInFY.reduce((sum, s) => sum + (s.total === 0 ? s.int : 0), 0);
        const closingBal = openingBal - prinPaid + capitalizedInt;

        const fyEndDate = getFYEndDate(fy);
        const next12Start = new Date(fyEndDate);
        next12Start.setDate(next12Start.getDate() + 1);
        const next12End = new Date(next12Start);
        next12End.setFullYear(next12End.getFullYear() + 1);

        // FIX: Ensure loan started on or before the fiscal year end to be considered for current liability
        const currentLiability = allLoanSchedules.filter(s =>
            s.date >= next12Start &&
            s.date < next12End &&
            (loanStartDates.get(s.id) < next12Start)
        ).reduce((sum, s) => sum + s.prin, 0);

        const longTermLiability = Math.max(0, closingBal - currentLiability);

        const row = fiscalBody.insertRow();
        row.innerHTML = `
                <td>FY ${fy}</td>
                <td>₹${Math.round(openingBal).toLocaleString()}</td>
                <td>₹${Math.round(intPaid).toLocaleString()}</td>
                <td>₹${Math.round(prinPaid).toLocaleString()}</td>
                <td>₹${Math.round(closingBal).toLocaleString()}</td>
                <td><span class="liability-tag curr">₹${Math.round(currentLiability).toLocaleString()}</span></td>
                <td><span class="liability-tag long">₹${Math.round(longTermLiability).toLocaleString()}</span></td>
            `;
    });

    let displaySchedule = [...allLoanSchedules];
    if (filterSelect.value !== 'all') { displaySchedule = displaySchedule.filter(item => item.id == filterSelect.value); }
    displaySchedule.sort((a, b) => a.date - b.date);

    // Populate export data
    exportData = {
        loans: calculatedLoans,
        fiscal: [],
        schedule: displaySchedule
    };

    // Re-calculate fiscal data for export object (cleaner separation)
    // Re-calculate fiscal data for export object (cleaner separation)
    // Create lookup for efficiency (if not already accessible, but we can reuse the Map approach or just find it)
    // To be safe and simple effectively:
    const loanStartDatesForExport = new Map(calculatedLoans.map(l => [l.id, l.dDate]));

    fyList.forEach(fy => {
        const paymentsInFY = allLoanSchedules.filter(s => getFY(s.date) === fy);
        const openingBal = calculatedLoans.reduce((sum, loan) => {
            const firstPayment = paymentsInFY.find(p => p.id === loan.id);
            return sum + (firstPayment ? firstPayment.open : 0);
        }, 0);
        const intPaid = paymentsInFY.reduce((sum, s) => sum + s.int, 0);
        const prinPaid = paymentsInFY.reduce((sum, s) => sum + s.prin, 0);

        // Add capitalized interest to closing balance (interest charged but not paid) for export data
        const capitalizedInt = paymentsInFY.reduce((sum, s) => sum + (s.total === 0 ? s.int : 0), 0);
        const closingBal = openingBal - prinPaid + capitalizedInt;

        const fyEndDate = getFYEndDate(fy);
        const next12Start = new Date(fyEndDate);
        next12Start.setDate(next12Start.getDate() + 1);
        const next12End = new Date(next12Start);
        next12End.setFullYear(next12End.getFullYear() + 1);

        // FIX: Ensure loan started on or before the fiscal year end
        const currentLiability = allLoanSchedules.filter(s =>
            s.date >= next12Start &&
            s.date < next12End &&
            (loanStartDatesForExport.get(s.id) < next12Start)
        ).reduce((sum, s) => sum + s.prin, 0);

        const longTermLiability = Math.max(0, closingBal - currentLiability);

        exportData.fiscal.push({
            fy: `FY ${fy}`,
            open: openingBal,
            int: intPaid,
            prin: prinPaid,
            close: closingBal,
            curr: currentLiability,
            long: longTermLiability
        });
    });

    renderEMITable(displaySchedule);
}

function renderEMITable(schedule) {
    const body = document.getElementById('emiScheduleBody');
    body.innerHTML = schedule.map((item, index) => {
        // Calculate closing balance properly handling zero-payment moratoriums where interest capitalizes.
        let closingBalance = item.open - item.prin;
        if (item.total === 0) {
            closingBalance = item.open + item.int;
        }

        return `
            <tr>
                <td style="text-align: left; color: #94a3b8; font-family: monospace;">${index + 1}</td>
                <td style="text-align: left;">${new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td style="text-align: left;">${item.name}</td>
                <td>₹${Math.round(item.open).toLocaleString()}</td>
                <td style="font-weight: bold;">₹${Math.round(item.total).toLocaleString()}</td>
                <td style="color: #ef4444;">₹${Math.round(item.int).toLocaleString()}</td>
                <td style="color: #166534;">₹${Math.round(item.prin).toLocaleString()}</td>
                <td>₹${Math.max(0, Math.round(closingBalance)).toLocaleString()}</td>
            </tr>
        `
    }).join('');
}

function renderTabs() {
    const container = document.getElementById('borrowerTabs');
    container.innerHTML = Object.keys(db).map(name => `
            <div class="tab ${name === activeBorrower ? 'active' : ''}" onclick="selectBorrower('${name}')">${name}</div>
        `).join('');
}

function clearAllData() {
    if (confirm("CRITICAL: This will permanently delete ALL data. Proceed?")) {
        db = {};
        localStorage.removeItem('borrower_db');
        activeBorrower = null;
        updateDisplay();
        updateTimestamp('Clear');
        alert("Memory cleared successfully.");
    }
}

function save() {
    localStorage.setItem('borrower_db', JSON.stringify(db));
    const status = document.getElementById('syncStatus');
    status.innerText = "Auto-saved";
    status.style.display = "inline-block";
    status.style.opacity = "1";
}

if (Object.keys(db).length > 0) selectBorrower(Object.keys(db)[0]);