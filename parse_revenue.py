import csv
import json
from collections import defaultdict

# County code mapping (first 2 digits of County District Code)
COUNTY_CODES = {
    '01': 'Adams', '02': 'Asotin', '03': 'Benton', '04': 'Chelan', '05': 'Clallam',
    '06': 'Clark', '07': 'Columbia', '08': 'Cowlitz', '09': 'Douglas', '10': 'Ferry',
    '11': 'Franklin', '12': 'Garfield', '13': 'Grant', '14': 'Grays Harbor', '15': 'Island',
    '16': 'Jefferson', '17': 'King', '18': 'Kitsap', '19': 'Kittitas', '20': 'Klickitat',
    '21': 'Lewis', '22': 'Lincoln', '23': 'Mason', '24': 'Okanogan', '25': 'Pacific',
    '26': 'Pend Oreille', '27': 'Pierce', '28': 'San Juan', '29': 'Skagit', '30': 'Skamania',
    '31': 'Snohomish', '32': 'Spokane', '33': 'Stevens', '34': 'Thurston', '35': 'Wahkiakum',
    '36': 'Walla Walla', '37': 'Whatcom', '38': 'Whitman', '39': 'Yakima'
}

def parse_revenues():
    """Parse OSPI F-196 revenue data and aggregate by district and source type."""

    # Read revenue data
    revenues = defaultdict(lambda: {'local': 0, 'state': 0, 'federal': 0, 'other': 0, 'total': 0})

    with open('data/ospi_revenues_2023-24.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            district_code = row['County District Code']
            revenue_code = int(row['Revenue Code'])
            amount = float(row['Amount'])

            # Categorize by revenue code
            # 1000-2999: Local
            # 3000-4999: State
            # 5000-6999: Federal
            # 7000-9999: Other (other districts, entities, financing)
            if 1000 <= revenue_code < 3000:
                revenues[district_code]['local'] += amount
            elif 3000 <= revenue_code < 5000:
                revenues[district_code]['state'] += amount
            elif 5000 <= revenue_code < 7000:
                revenues[district_code]['federal'] += amount
            else:
                revenues[district_code]['other'] += amount

            revenues[district_code]['total'] += amount

    return revenues

def get_district_names():
    """Get district names from enrollment data."""
    districts = {}

    with open('ospi_enrollment_2024-25.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['OrganizationLevel'] == 'School':  # Only process school-level rows
                district_code = row['DistrictCode']
                district_name = row['DistrictName']
                county = row['County']
                if district_code not in districts:
                    districts[district_code] = {
                        'name': district_name,
                        'county': county
                    }

    return districts

def create_county_district_mapping():
    """Create mapping from County District Code to district info."""
    # The County District Code format: CCXXX where CC = county code, XXX = district number
    # The DistrictCode in enrollment is just XXXXX (5 digits)
    # We need to match them somehow

    # For now, let's just output the raw data with County District Code
    # and we can match by name later
    pass

def main():
    print("Parsing revenue data...")
    revenues = parse_revenues()

    print(f"Found {len(revenues)} districts in revenue data")

    # Sort by total revenue (descending) and show top 20
    sorted_districts = sorted(revenues.items(), key=lambda x: x[1]['total'], reverse=True)

    print("\nTop 20 districts by total revenue:")
    print("-" * 80)
    for code, data in sorted_districts[:20]:
        county_code = code[:2]
        county_name = COUNTY_CODES.get(county_code, 'Unknown')
        total_m = data['total'] / 1_000_000
        state_pct = (data['state'] / data['total'] * 100) if data['total'] > 0 else 0
        local_pct = (data['local'] / data['total'] * 100) if data['total'] > 0 else 0
        federal_pct = (data['federal'] / data['total'] * 100) if data['total'] > 0 else 0
        print(f"{code} ({county_name}): ${total_m:,.1f}M (State: {state_pct:.1f}%, Local: {local_pct:.1f}%, Federal: {federal_pct:.1f}%)")

    # Create JSON output
    output = []
    for code, data in sorted_districts:
        county_code = code[:2]
        output.append({
            'countyDistrictCode': code,
            'countyCode': county_code,
            'countyName': COUNTY_CODES.get(county_code, 'Unknown'),
            'totalRevenue': round(data['total'], 2),
            'stateRevenue': round(data['state'], 2),
            'localRevenue': round(data['local'], 2),
            'federalRevenue': round(data['federal'], 2),
            'otherRevenue': round(data['other'], 2),
            'statePct': round(data['state'] / data['total'] * 100, 1) if data['total'] > 0 else 0,
            'localPct': round(data['local'] / data['total'] * 100, 1) if data['total'] > 0 else 0,
            'federalPct': round(data['federal'] / data['total'] * 100, 1) if data['total'] > 0 else 0
        })

    with open('data/district_revenues_2023-24.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved {len(output)} districts to data/district_revenues_2023-24.json")

if __name__ == '__main__':
    main()
