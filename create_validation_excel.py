"""
OSPI Data Validation Script
Downloads and processes OSPI data, compares with districts.json
Creates Excel file for data validation
"""

import pandas as pd
import json
import os

# Set working directory
os.chdir(r"C:\k12 funding 2025")

# Load our districts.json data
with open("data/districts.json", "r") as f:
    our_districts = json.load(f)

# Convert to DataFrame for easier comparison
our_df = pd.DataFrame(our_districts)
our_df = our_df[our_df['y'] == '2024-25']  # Filter to 2024-25 only
our_df = our_df.rename(columns={
    'n': 'District Name',
    't': 'Our Enrollment',
    'li': 'Our Low-Income %',
    'el': 'Our ELL %',
    'sp': 'Our SpEd %'
})

print("Loading OSPI enrollment data...")

# Read OSPI data
ospi_df = pd.read_csv("ospi_enrollment_2024-25.csv", low_memory=False)

# Filter to District level only (not school or grade level)
ospi_district = ospi_df[ospi_df['OrganizationLevel'] == 'District'].copy()

print(f"Found {len(ospi_district)} district-level records")

# Get our target districts
target_districts = [
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
]

# Function to find matching district in OSPI data
def find_district(name, ospi_data):
    # Try exact match first
    match = ospi_data[ospi_data['DistrictName'] == name]
    if len(match) > 0:
        return match

    # Try partial match
    for idx, row in ospi_data.iterrows():
        if name.replace(" School District", "").replace(" Public Schools", "") in row['DistrictName']:
            return ospi_data[ospi_data['DistrictName'] == row['DistrictName']]

    return pd.DataFrame()

# Aggregate OSPI data by district
print("\nAggregating OSPI data by district...")

ospi_aggregated = []

for district_name in target_districts:
    district_data = find_district(district_name, ospi_district)

    if len(district_data) == 0:
        print(f"  Warning: No data found for {district_name}")
        continue

    # Sum across all grades for each district
    row = district_data.iloc[0]  # District level should have one row

    # Get enrollment and demographics
    try:
        total_enrollment = pd.to_numeric(row['All Students'], errors='coerce')
        low_income = pd.to_numeric(row['Low-Income'], errors='coerce')
        ell = pd.to_numeric(row['English Language Learners'], errors='coerce')
        sped = pd.to_numeric(row['Students with Disabilities'], errors='coerce')

        ospi_aggregated.append({
            'District Name': district_name,
            'OSPI Enrollment': total_enrollment,
            'OSPI Low-Income': low_income,
            'OSPI Low-Income %': round(low_income / total_enrollment, 3) if total_enrollment > 0 else 0,
            'OSPI ELL': ell,
            'OSPI ELL %': round(ell / total_enrollment, 3) if total_enrollment > 0 else 0,
            'OSPI SpEd': sped,
            'OSPI SpEd %': round(sped / total_enrollment, 3) if total_enrollment > 0 else 0
        })
        print(f"  Found: {district_name} - {total_enrollment:,} students")
    except Exception as e:
        print(f"  Error processing {district_name}: {e}")

ospi_agg_df = pd.DataFrame(ospi_aggregated)

# Merge our data with OSPI data
print("\nMerging datasets...")

comparison_df = our_df[['District Name', 'Our Enrollment', 'Our Low-Income %', 'Our ELL %', 'Our SpEd %']].copy()
comparison_df = comparison_df.merge(ospi_agg_df, on='District Name', how='outer')

# Calculate differences
comparison_df['Enrollment Diff'] = comparison_df['OSPI Enrollment'] - comparison_df['Our Enrollment']
comparison_df['Enrollment Diff %'] = round((comparison_df['Enrollment Diff'] / comparison_df['OSPI Enrollment'] * 100), 1)
comparison_df['Low-Income Diff'] = round((comparison_df['OSPI Low-Income %'] - comparison_df['Our Low-Income %']) * 100, 1)
comparison_df['ELL Diff'] = round((comparison_df['OSPI ELL %'] - comparison_df['Our ELL %']) * 100, 1)
comparison_df['SpEd Diff'] = round((comparison_df['OSPI SpEd %'] - comparison_df['Our SpEd %']) * 100, 1)

# Reorder columns for clarity
column_order = [
    'District Name',
    'Our Enrollment', 'OSPI Enrollment', 'Enrollment Diff', 'Enrollment Diff %',
    'Our Low-Income %', 'OSPI Low-Income %', 'Low-Income Diff',
    'Our ELL %', 'OSPI ELL %', 'ELL Diff',
    'Our SpEd %', 'OSPI SpEd %', 'SpEd Diff'
]

# Only include columns that exist
final_columns = [c for c in column_order if c in comparison_df.columns]
comparison_df = comparison_df[final_columns]

# Create Excel file with multiple sheets
print("\nCreating Excel file...")

with pd.ExcelWriter('data_validation.xlsx', engine='openpyxl') as writer:
    # Sheet 1: Comparison Summary
    comparison_df.to_excel(writer, sheet_name='Comparison', index=False)

    # Sheet 2: Our Data (from districts.json)
    our_full_df = pd.DataFrame(our_districts)
    our_full_df.to_excel(writer, sheet_name='Our Data', index=False)

    # Sheet 3: OSPI Raw Data (district level only, for our target districts)
    ospi_target = ospi_district[ospi_district['DistrictName'].str.contains('|'.join([d.split()[0] for d in target_districts]), case=False, na=False)]
    if len(ospi_target) > 0:
        ospi_target.to_excel(writer, sheet_name='OSPI Raw', index=False)

print("\n" + "="*60)
print("Excel file created: data_validation.xlsx")
print("="*60)

# Print summary
print("\nValidation Summary:")
print("-" * 60)
for _, row in comparison_df.iterrows():
    district = row['District Name']
    enroll_diff = row.get('Enrollment Diff %', 'N/A')
    li_diff = row.get('Low-Income Diff', 'N/A')
    print(f"{district}:")
    print(f"  Enrollment diff: {enroll_diff}%")
    print(f"  Low-Income diff: {li_diff} percentage points")
    print()
