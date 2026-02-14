#!/usr/bin/env python3
"""
Create a simple CBC lab report PDF using fpdf2 (compatible with pdf-parse)
"""
from fpdf import FPDF
import json
from datetime import datetime

# Read NHANES data
with open("../data/CBC_J.json", "r") as f:
    data = json.load(f)

# Find a record with complete data
sample_record = None
for record in data:
    if (
        record.get("LBXHGB")
        and record.get("LBXWBCSI")
        and record.get("LBXPLTSI")
        and record.get("LBXRBCSI")
    ):
        sample_record = record
        break

if not sample_record:
    print("No complete record found")
    exit(1)


# Create PDF using fpdf2
class CBCReport(FPDF):
    def header(self):
        self.set_font("Arial", "B", 16)
        self.cell(
            0, 10, "CLARION MEDICAL CENTER", align="L", new_x="LMARGIN", new_y="NEXT"
        )
        self.set_font("Arial", "", 9)
        self.cell(
            0,
            5,
            "123 Healthcare Drive, Medical City, MC 12345",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.cell(
            0,
            5,
            "Phone: (555) 123-4567 | Fax: (555) 123-4568 | NPI: 1234567890",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.ln(5)

    def footer(self):
        self.set_y(-25)
        self.set_font("Arial", "", 8)
        self.cell(
            0,
            5,
            "This report is for demonstration purposes only.",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.cell(
            0,
            5,
            "Data sourced from NHANES (National Health and Nutrition Examination Survey)",
            new_x="LMARGIN",
            new_y="NEXT",
        )


pdf = CBCReport()
pdf.add_page()

# Patient info section
pdf.set_font("Arial", "B", 12)
pdf.cell(0, 8, "LABORATORY REPORT", new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)

pdf.set_font("Arial", "", 10)
pdf.cell(
    0,
    6,
    f"Patient ID: SAMPLE-{sample_record.get('SEQN', '12345')}",
    new_x="LMARGIN",
    new_y="NEXT",
)
pdf.cell(
    0,
    6,
    f"Date of Service: {datetime.now().strftime('%m/%d/%Y')}",
    new_x="LMARGIN",
    new_y="NEXT",
)
pdf.cell(0, 6, "Ordering Physician: Dr. Jane Smith, MD", new_x="LMARGIN", new_y="NEXT")
pdf.ln(5)

# CBC Panel heading
pdf.set_font("Arial", "B", 12)
pdf.cell(0, 8, "COMPLETE BLOOD COUNT (CBC) PANEL", new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)

# Column headers
pdf.set_font("Arial", "B", 9)
pdf.cell(90, 6, "Test Name", border=0)
pdf.cell(25, 6, "Result", border=0)
pdf.cell(35, 6, "Unit", border=0)
pdf.cell(40, 6, "Reference Range", border=0, new_x="LMARGIN", new_y="NEXT")
pdf.line(10, pdf.get_y(), 200, pdf.get_y())
pdf.ln(1)

# Test results
pdf.set_font("Arial", "", 9)

tests = [
    ("Hemoglobin", f"{sample_record['LBXHGB']:.1f}", "g/dL", "13.5-17.5"),
    (
        "White Blood Cell Count",
        f"{sample_record['LBXWBCSI']:.1f}",
        "10^3/mcL",
        "4.5-11.0",
    ),
    ("Platelet Count", f"{sample_record['LBXPLTSI']:.0f}", "10^3/mcL", "150-400"),
    (
        "Red Blood Cell Count",
        f"{sample_record['LBXRBCSI']:.2f}",
        "million cells/mcL",
        "4.5-5.9",
    ),
    ("Hematocrit", f"{sample_record.get('LBXHCT', 42.0):.1f}", "%", "38.0-50.0"),
    (
        "Mean Corpuscular Volume",
        f"{sample_record.get('LBXMCVSI', 88.0):.1f}",
        "fL",
        "80-100",
    ),
    (
        "Mean Corpuscular Hemoglobin",
        f"{sample_record.get('LBXMC', 30.0):.1f}",
        "pg",
        "27-33",
    ),
    ("MCHC", f"{sample_record.get('LBXMCHSI', 34.0):.1f}", "g/dL", "32-36"),
    (
        "Red Cell Distribution Width",
        f"{sample_record.get('LBXRDW', 13.0):.1f}",
        "%",
        "11.5-14.5",
    ),
]

# Add differential if available
if sample_record.get("LBXNEPCT"):
    tests.extend(
        [
            ("Neutrophils", f"{sample_record['LBXNEPCT']:.1f}", "%", "40-70"),
            ("Lymphocytes", f"{sample_record['LBXLYPCT']:.1f}", "%", "20-45"),
            ("Monocytes", f"{sample_record.get('LBXMOPCT', 7.0):.1f}", "%", "2-10"),
            ("Eosinophils", f"{sample_record.get('LBXEOPCT', 2.0):.1f}", "%", "0-6"),
            ("Basophils", f"{sample_record.get('LBXBAPCT', 0.5):.1f}", "%", "0-2"),
        ]
    )

if sample_record.get("LBDNENO"):
    tests.extend(
        [
            (
                "Absolute Neutrophil Count",
                f"{sample_record['LBDNENO']:.1f}",
                "10^3/mcL",
                "1.8-7.0",
            ),
            (
                "Absolute Lymphocyte Count",
                f"{sample_record['LBDLYMNO']:.1f}",
                "10^3/mcL",
                "1.0-4.8",
            ),
        ]
    )

# Draw each test result
for test_name, result, unit, ref_range in tests:
    pdf.cell(90, 5, test_name, border=0)
    pdf.cell(25, 5, result, border=0)
    pdf.cell(35, 5, unit, border=0)
    pdf.cell(40, 5, ref_range, border=0, new_x="LMARGIN", new_y="NEXT")

# Save PDF
output_path = "../public/sample_cbc_report.pdf"
pdf.output(output_path)

print(f"✅ Created fpdf2-based CBC report: {output_path}")
