const fs = require('fs');

// Load current districts.json
const districts = JSON.parse(fs.readFileSync('data/districts.json', 'utf-8'));

// Load revenue data
const revenues = JSON.parse(fs.readFileSync('data/district_revenues_matched_2023-24.json', 'utf-8'));

// Create lookup by County District Code
const revenueByCode = {};
for (const r of revenues) {
    revenueByCode[r.countyDistrictCode] = r;
}

// Manual mapping: district name in districts.json -> County District Code in OSPI data
const districtCodeMapping = {
    'Auburn School District': '17408',      // Auburn is 17408, not 17001
    'Bellevue School District': '17405',
    'Federal Way Public Schools': '17210',
    'Kent School District': '17415',
    'Lake Washington School District': '17414',
    'Seattle Public Schools': '17001',
    'Spokane Public Schools': '32081',
    'Tacoma Public Schools': '27010',       // Tacoma is 27010, not 27403
    'Yakima School District': '39120',      // Need to check
    'Vancouver Public Schools': '06037',    // Vancouver is 06037, not 06114 (Evergreen)
    'Renton School District': '17403',      // Renton is 17403, not 17408
    'Northshore School District': '17417',
    'Issaquah School District': '17411',
    'Puyallup School District': '27003',
    'Highline School District': '17401',
    'Mercer Island School District': '17400',
    'Bethel School District': '27403',      // Bethel is 27403
    'Everett School District': '31002',
    'Edmonds School District': '31015',
    'Olympia School District': '34003',     // This might be North Thurston
    'Richland School District': '03400',
    'Kennewick School District': '03017',
    'Pasco School District': '11001',       // Pasco is 11001
    'Bellingham School District': '37501',
    'Mead School District': '32354',
    'Central Valley School District': '32356'
};

console.log("Matching districts with revenue data using code mapping...\n");

// First, let's find the correct codes by looking at revenue data
console.log("Looking up correct codes in revenue data:\n");

for (const [name, code] of Object.entries(districtCodeMapping)) {
    const rev = revenueByCode[code];
    if (rev) {
        console.log(`${name} -> ${code}: ${rev.districtName} ($${(rev.totalRevenue/1e6).toFixed(1)}M)`);
    } else {
        console.log(`${name} -> ${code}: NOT FOUND`);
    }
}

// Let's also search for districts we couldn't find
console.log("\n\nSearching for missing districts in revenue data:\n");
const missingNames = ['Tacoma', 'Yakima', 'Vancouver', 'Olympia', 'Pasco'];
for (const name of missingNames) {
    const found = revenues.filter(r => r.districtName.toLowerCase().includes(name.toLowerCase()));
    console.log(`\n${name}:`);
    found.forEach(r => console.log(`  ${r.countyDistrictCode}: ${r.districtName} ($${(r.totalRevenue/1e6).toFixed(1)}M)`));
}

// Correct the mapping based on findings
const correctedMapping = {
    'Auburn School District': '17408',
    'Bellevue School District': '17405',
    'Federal Way Public Schools': '17210',
    'Kent School District': '17415',
    'Lake Washington School District': '17414',
    'Seattle Public Schools': '17001',
    'Spokane Public Schools': '32081',
    'Tacoma Public Schools': '27010',
    'Yakima School District': '39007',  // Corrected: 39007 is Yakima School District ($556.3M)
    'Vancouver Public Schools': '06037',
    'Renton School District': '17403',
    'Northshore School District': '17417',
    'Issaquah School District': '17411',
    'Puyallup School District': '27003',
    'Highline School District': '17401',
    'Mercer Island School District': '17400',
    'Bethel School District': '27403',
    'Everett School District': '31002',
    'Edmonds School District': '31015',
    'Olympia School District': '34111',  // Corrected: 34111 is Olympia School District ($332.1M)
    'Richland School District': '03400',
    'Kennewick School District': '03017',
    'Pasco School District': '11001',
    'Bellingham School District': '37501',
    'Mead School District': '32354',
    'Central Valley School District': '32356'
};

console.log("\n\nUpdating districts with revenue data:\n");

const updatedDistricts = [];

for (const d of districts) {
    const name = d.n;
    const code = correctedMapping[name];

    if (code) {
        const revenue = revenueByCode[code];
        if (revenue) {
            // OSPI F-196 data appears to be doubled, divide by 2
            console.log(`✓ ${name} -> ${code}: ${revenue.districtName} ($${(revenue.totalRevenue/2/1e6).toFixed(1)}M)`);
            updatedDistricts.push({
                ...d,
                rev: Math.round(revenue.totalRevenue / 2),
                revState: Math.round(revenue.stateRevenue / 2),
                revLocal: Math.round(revenue.localRevenue / 2),
                revFederal: Math.round(revenue.federalRevenue / 2),
                revOther: Math.round(revenue.otherRevenue / 2),
                revStatePct: revenue.statePct,
                revLocalPct: revenue.localPct,
                revFederalPct: revenue.federalPct
            });
        } else {
            console.log(`✗ ${name} -> ${code}: NOT FOUND IN REVENUE DATA`);
            updatedDistricts.push(d);
        }
    } else {
        console.log(`✗ ${name}: NO CODE MAPPING`);
        updatedDistricts.push(d);
    }
}

// Save updated districts
fs.writeFileSync('data/districts_with_revenue.json', JSON.stringify(updatedDistricts, null, 2));
console.log(`\nSaved ${updatedDistricts.length} districts to data/districts_with_revenue.json`);
