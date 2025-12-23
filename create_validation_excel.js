/**
 * OSPI Data Validation Script
 * Processes OSPI enrollment data and compares with districts.json
 * Creates Excel file for data validation
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read our districts.json
const ourDistricts = JSON.parse(fs.readFileSync('data/districts.json', 'utf8'));

// Filter to 2024-25 only
const our2024 = ourDistricts.filter(d => d.y === '2024-25');

console.log(`Our data: ${our2024.length} districts for 2024-25`);

// Read OSPI CSV data
const ospiContent = fs.readFileSync('ospi_enrollment_2024-25.csv', 'utf8');
const lines = ospiContent.split('\n');
const headers = lines[0].split(',');

console.log(`OSPI data: ${lines.length - 1} total rows`);

// Parse CSV into objects
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// Get all OSPI records
const ospiRecords = [];
for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = parseCSVLine(lines[i]);
    const record = {};
    headers.forEach((h, idx) => {
        record[h.trim()] = values[idx] || '';
    });
    ospiRecords.push(record);
}

console.log(`Parsed ${ospiRecords.length} OSPI records`);

// Filter to district level with "All Grades" (total enrollment)
const districtLevel = ospiRecords.filter(r =>
    r.OrganizationLevel === 'District' && r.GradeLevel === 'All Grades'
);
console.log(`Found ${districtLevel.length} district-level "All Grades" records`);

// Our target districts
const targetDistricts = [
    "Auburn School District",
    "Bellevue School District",
    "Federal Way Public Schools",
    "Kent School District",
    "Lake Washington School District",
    "Seattle Public Schools",
    "Spokane Public Schools",
    "Tacoma Public Schools",
    "Yakima School District",
    "Vancouver Public Schools",
    "Renton School District",
    "Northshore School District",
    "Issaquah School District",
    "Puyallup School District"
];

// Find matching districts in OSPI data
function findDistrict(name, ospiData) {
    // Try exact match
    let match = ospiData.filter(r => r.DistrictName === name);
    if (match.length > 0) return match[0];

    // Try without suffix
    const simpleName = name.replace(' School District', '').replace(' Public Schools', '');
    match = ospiData.filter(r => r.DistrictName && r.DistrictName.includes(simpleName));
    if (match.length > 0) return match[0];

    return null;
}

// Build comparison data
const comparisonData = [];

for (const ourDist of our2024) {
    const ospiMatch = findDistrict(ourDist.n, districtLevel);

    const row = {
        'District Name': ourDist.n,
        'County': ourDist.c,
        'Our Enrollment': ourDist.t,
        'OSPI Enrollment': ospiMatch ? parseInt(ospiMatch['All Students']) || 0 : 'Not Found',
        'Enrollment Diff': '',
        'Enrollment Diff %': '',
        'Our Low-Income %': (ourDist.li * 100).toFixed(1) + '%',
        'OSPI Low-Income': ospiMatch ? parseInt(ospiMatch['Low-Income']) || 0 : 'Not Found',
        'OSPI Low-Income %': '',
        'Low-Income Diff': '',
        'Our ELL %': (ourDist.el * 100).toFixed(1) + '%',
        'OSPI ELL': ospiMatch ? parseInt(ospiMatch['English Language Learners']) || 0 : 'Not Found',
        'OSPI ELL %': '',
        'ELL Diff': '',
        'Our SpEd %': (ourDist.sp * 100).toFixed(1) + '%',
        'OSPI SpEd': ospiMatch ? parseInt(ospiMatch['Students with Disabilities']) || 0 : 'Not Found',
        'OSPI SpEd %': '',
        'SpEd Diff': ''
    };

    if (ospiMatch) {
        const ospiEnroll = parseInt(ospiMatch['All Students']) || 0;
        const ospiLowIncome = parseInt(ospiMatch['Low-Income']) || 0;
        const ospiELL = parseInt(ospiMatch['English Language Learners']) || 0;
        const ospiSpEd = parseInt(ospiMatch['Students with Disabilities']) || 0;

        row['Enrollment Diff'] = ospiEnroll - ourDist.t;
        row['Enrollment Diff %'] = ((ospiEnroll - ourDist.t) / ospiEnroll * 100).toFixed(1) + '%';

        const ospiLiPct = ospiEnroll > 0 ? ospiLowIncome / ospiEnroll : 0;
        const ospiEllPct = ospiEnroll > 0 ? ospiELL / ospiEnroll : 0;
        const ospiSpedPct = ospiEnroll > 0 ? ospiSpEd / ospiEnroll : 0;

        row['OSPI Low-Income %'] = (ospiLiPct * 100).toFixed(1) + '%';
        row['Low-Income Diff'] = ((ospiLiPct - ourDist.li) * 100).toFixed(1) + ' pts';

        row['OSPI ELL %'] = (ospiEllPct * 100).toFixed(1) + '%';
        row['ELL Diff'] = ((ospiEllPct - ourDist.el) * 100).toFixed(1) + ' pts';

        row['OSPI SpEd %'] = (ospiSpedPct * 100).toFixed(1) + '%';
        row['SpEd Diff'] = ((ospiSpedPct - ourDist.sp) * 100).toFixed(1) + ' pts';

        console.log(`  ✓ ${ourDist.n}: Our ${ourDist.t} vs OSPI ${ospiEnroll} (diff: ${row['Enrollment Diff']})`);
    } else {
        console.log(`  ✗ ${ourDist.n}: No OSPI match found`);
    }

    comparisonData.push(row);
}

// Create Excel workbook
const wb = XLSX.utils.book_new();

// Sheet 1: Comparison Summary
const ws1 = XLSX.utils.json_to_sheet(comparisonData);

// Set column widths
ws1['!cols'] = [
    { wch: 30 }, // District Name
    { wch: 12 }, // County
    { wch: 14 }, // Our Enrollment
    { wch: 14 }, // OSPI Enrollment
    { wch: 12 }, // Enrollment Diff
    { wch: 14 }, // Enrollment Diff %
    { wch: 14 }, // Our Low-Income %
    { wch: 12 }, // OSPI Low-Income
    { wch: 15 }, // OSPI Low-Income %
    { wch: 12 }, // Low-Income Diff
    { wch: 10 }, // Our ELL %
    { wch: 10 }, // OSPI ELL
    { wch: 12 }, // OSPI ELL %
    { wch: 10 }, // ELL Diff
    { wch: 10 }, // Our SpEd %
    { wch: 10 }, // OSPI SpEd
    { wch: 12 }, // OSPI SpEd %
    { wch: 10 }  // SpEd Diff
];

XLSX.utils.book_append_sheet(wb, ws1, 'Comparison');

// Sheet 2: Our Data (from districts.json)
const ourDataSheet = ourDistricts.map(d => ({
    'District ID': d.d,
    'District Name': d.n,
    'County': d.c,
    'Year': d.y,
    'Enrollment': d.t,
    'Low-Income %': (d.li * 100).toFixed(1) + '%',
    'ELL %': (d.el * 100).toFixed(1) + '%',
    'SpEd %': (d.sp * 100).toFixed(1) + '%',
    'CIS': d.cis,
    'LEA Type': d.lea,
    'Assessed Value': d.av
}));
const ws2 = XLSX.utils.json_to_sheet(ourDataSheet);
ws2['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 6 }, { wch: 10 }, { wch: 18 }
];
XLSX.utils.book_append_sheet(wb, ws2, 'Our Data');

// Sheet 3: OSPI District Data
const ospiDistrictData = districtLevel.filter(r => {
    return targetDistricts.some(t => {
        const simple = t.replace(' School District', '').replace(' Public Schools', '');
        return r.DistrictName && r.DistrictName.includes(simple);
    });
}).map(r => ({
    'District Name': r.DistrictName,
    'County': r.County,
    'All Students': r['All Students'],
    'Low-Income': r['Low-Income'],
    'ELL': r['English Language Learners'],
    'SpEd': r['Students with Disabilities'],
    'Homeless': r['Homeless'],
    'Foster Care': r['Foster Care'],
    'Migrant': r['Migrant']
}));
const ws3 = XLSX.utils.json_to_sheet(ospiDistrictData);
ws3['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
];
XLSX.utils.book_append_sheet(wb, ws3, 'OSPI Data');

// Sheet 4: Data Sources
const sourcesData = [
    { 'Source': 'OSPI Report Card Enrollment 2024-25', 'URL': 'https://data.wa.gov/education/Report-Card-Enrollment-2024-25-School-Year/2rwv-gs2e' },
    { 'Source': 'Data As Of', 'URL': 'June 2, 2025' },
    { 'Source': 'Validation Created', 'URL': new Date().toLocaleDateString() }
];
const ws4 = XLSX.utils.json_to_sheet(sourcesData);
XLSX.utils.book_append_sheet(wb, ws4, 'Data Sources');

// Write the Excel file
const outputPath = 'data_validation.xlsx';
XLSX.writeFile(wb, outputPath);

console.log('\n' + '='.repeat(60));
console.log(`Excel file created: ${outputPath}`);
console.log('='.repeat(60));
console.log('\nSheets:');
console.log('  1. Comparison - Side-by-side comparison of Our Data vs OSPI');
console.log('  2. Our Data - Full contents of districts.json');
console.log('  3. OSPI Data - Relevant OSPI district-level records');
console.log('  4. Data Sources - Source URLs and dates');
