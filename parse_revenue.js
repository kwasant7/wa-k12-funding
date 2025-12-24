const fs = require('fs');

// County code mapping (first 2 digits of County District Code)
const COUNTY_CODES = {
    '01': 'Adams', '02': 'Asotin', '03': 'Benton', '04': 'Chelan', '05': 'Clallam',
    '06': 'Clark', '07': 'Columbia', '08': 'Cowlitz', '09': 'Douglas', '10': 'Ferry',
    '11': 'Franklin', '12': 'Garfield', '13': 'Grant', '14': 'Grays Harbor', '15': 'Island',
    '16': 'Jefferson', '17': 'King', '18': 'Kitsap', '19': 'Kittitas', '20': 'Klickitat',
    '21': 'Lewis', '22': 'Lincoln', '23': 'Mason', '24': 'Okanogan', '25': 'Pacific',
    '26': 'Pend Oreille', '27': 'Pierce', '28': 'San Juan', '29': 'Skagit', '30': 'Skamania',
    '31': 'Snohomish', '32': 'Spokane', '33': 'Stevens', '34': 'Thurston', '35': 'Wahkiakum',
    '36': 'Walla Walla', '37': 'Whatcom', '38': 'Whitman', '39': 'Yakima'
};

function parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^\ufeff/, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] ? values[idx].trim() : '';
        });
        data.push(row);
    }
    return data;
}

function main() {
    console.log("Parsing revenue data...");

    // Read revenue data
    const revenueCSV = fs.readFileSync('data/ospi_revenues_2023-24.csv', 'utf-8');
    const revenueData = parseCSV(revenueCSV);

    console.log(`Loaded ${revenueData.length} revenue records`);

    // Aggregate by district
    const revenues = {};

    for (const row of revenueData) {
        const districtCode = row['County District Code'];
        const revenueCode = parseInt(row['Revenue Code']);
        const amount = parseFloat(row['Amount']) || 0;

        if (!revenues[districtCode]) {
            revenues[districtCode] = { local: 0, state: 0, federal: 0, other: 0, total: 0 };
        }

        // Categorize by revenue code
        // 1000-2999: Local
        // 3000-4999: State
        // 5000-6999: Federal
        // 7000-9999: Other
        if (revenueCode >= 1000 && revenueCode < 3000) {
            revenues[districtCode].local += amount;
        } else if (revenueCode >= 3000 && revenueCode < 5000) {
            revenues[districtCode].state += amount;
        } else if (revenueCode >= 5000 && revenueCode < 7000) {
            revenues[districtCode].federal += amount;
        } else {
            revenues[districtCode].other += amount;
        }
        revenues[districtCode].total += amount;
    }

    console.log(`Found ${Object.keys(revenues).length} districts`);

    // Read enrollment data for district names
    const enrollmentCSV = fs.readFileSync('ospi_enrollment_2024-25.csv', 'utf-8');
    const enrollmentData = parseCSV(enrollmentCSV);

    // Build district name lookup by DistrictCode
    const districtNames = {};
    for (const row of enrollmentData) {
        const districtCode = row['DistrictCode'];
        if (!districtNames[districtCode]) {
            districtNames[districtCode] = {
                name: row['DistrictName'],
                county: row['County']
            };
        }
    }

    console.log(`Found ${Object.keys(districtNames).length} district names from enrollment data`);

    // Sort by total revenue (descending)
    const sortedDistricts = Object.entries(revenues).sort((a, b) => b[1].total - a[1].total);

    console.log("\nTop 20 districts by total revenue:");
    console.log("-".repeat(100));
    for (let i = 0; i < 20 && i < sortedDistricts.length; i++) {
        const [code, data] = sortedDistricts[i];
        const countyCode = code.slice(0, 2);
        const countyName = COUNTY_CODES[countyCode] || 'Unknown';
        const totalM = (data.total / 1_000_000).toFixed(1);
        const statePct = data.total > 0 ? (data.state / data.total * 100).toFixed(1) : 0;
        const localPct = data.total > 0 ? (data.local / data.total * 100).toFixed(1) : 0;
        const federalPct = data.total > 0 ? (data.federal / data.total * 100).toFixed(1) : 0;
        console.log(`${code} (${countyName}): $${totalM}M (State: ${statePct}%, Local: ${localPct}%, Federal: ${federalPct}%)`);
    }

    // Create JSON output
    const output = [];
    for (const [code, data] of sortedDistricts) {
        const countyCode = code.slice(0, 2);
        output.push({
            countyDistrictCode: code,
            countyCode: countyCode,
            countyName: COUNTY_CODES[countyCode] || 'Unknown',
            totalRevenue: Math.round(data.total * 100) / 100,
            stateRevenue: Math.round(data.state * 100) / 100,
            localRevenue: Math.round(data.local * 100) / 100,
            federalRevenue: Math.round(data.federal * 100) / 100,
            otherRevenue: Math.round(data.other * 100) / 100,
            statePct: data.total > 0 ? Math.round(data.state / data.total * 1000) / 10 : 0,
            localPct: data.total > 0 ? Math.round(data.local / data.total * 1000) / 10 : 0,
            federalPct: data.total > 0 ? Math.round(data.federal / data.total * 1000) / 10 : 0
        });
    }

    fs.writeFileSync('data/district_revenues_2023-24.json', JSON.stringify(output, null, 2));
    console.log(`\nSaved ${output.length} districts to data/district_revenues_2023-24.json`);

    // Now try to match with district names using the last 3 digits
    console.log("\n\nMatching districts with names...");

    // County District Code format: CCXXX where CC=county, XXX=district number within county
    // Let's try to match by looking for districts in the same county

    // Build a lookup for district names by county + district suffix
    const namesByCountyAndSuffix = {};
    for (const [distCode, info] of Object.entries(districtNames)) {
        const county = info.county;
        // DistrictCode might be like "31002" - 5 digits
        const suffix = distCode.slice(-3);  // last 3 digits
        const key = `${county}_${suffix}`;
        if (!namesByCountyAndSuffix[key]) {
            namesByCountyAndSuffix[key] = info.name;
        }
    }

    // Try to match
    const matched = [];
    const unmatched = [];

    for (const item of output) {
        const countyCode = item.countyCode;
        const countyName = item.countyName;
        const districtSuffix = item.countyDistrictCode.slice(-3);

        const key = `${countyName}_${districtSuffix}`;
        const name = namesByCountyAndSuffix[key];

        if (name) {
            item.districtName = name;
            matched.push(item);
        } else {
            unmatched.push(item);
        }
    }

    console.log(`Matched: ${matched.length}, Unmatched: ${unmatched.length}`);

    // Show some matched examples
    console.log("\nSample matched districts:");
    for (let i = 0; i < 10 && i < matched.length; i++) {
        const d = matched[i];
        console.log(`${d.countyDistrictCode}: ${d.districtName} - $${(d.totalRevenue/1e6).toFixed(1)}M`);
    }

    // Save matched data
    fs.writeFileSync('data/district_revenues_matched_2023-24.json', JSON.stringify(matched, null, 2));
    console.log(`\nSaved ${matched.length} matched districts to data/district_revenues_matched_2023-24.json`);
}

main();
