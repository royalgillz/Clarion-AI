#!/usr/bin/env python3
"""
scripts/convert_xpt.py

Convert the NHANES CBC_J.xpt (SAS XPORT format) dataset to:
  - data/CBC_J.csv
  - data/CBC_J.json  (records orientation)

This data is REFERENCE ONLY in our pipeline.
We DO NOT embed the rows — only the curated test metadata in seed_neo4j.ts uses Gemini.
The CSV/JSON is useful for:
  - Verifying NHANES variable names match our seed catalog
  - Building reference ranges from population percentiles
  - Optional: enriching the graph with population stats later

SETUP:
  pip install pandas pyreadstat
  # OR: pip install pandas  (pandas ≥ 1.0 can read XPT natively)

  Download CBC_J.xpt from:
  https://wwwn.cdc.gov/nchs/nhanes/2017-2018/CBC_J.XPT
  Place it at:  data/CBC_J.xpt

RUN:
  python scripts/convert_xpt.py
  # or: python scripts/convert_xpt.py --input data/CBC_J.xpt --out-dir data
"""

import argparse
import sys
from pathlib import Path

import pandas as pd


def load_xpt(filepath: str) -> pd.DataFrame:
    """
    Load a SAS XPORT (.xpt) file using pandas.
    pandas ≥ 1.0 supports read_sas natively.
    Falls back to pyreadstat if pandas read_sas fails.
    """
    path = Path(filepath)
    if not path.exists():
        print(f"ERROR: File not found: {filepath}", file=sys.stderr)
        print(
            "Download from: https://wwwn.cdc.gov/nchs/nhanes/2017-2018/CBC_J.XPT",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── Method 1: pandas native (preferred) ───────────────────────────────────
    try:
        df = pd.read_sas(filepath, format="xport", encoding="utf-8")
        print(f"✅ Loaded with pandas.read_sas: {len(df):,} rows × {len(df.columns)} cols")
        return df
    except Exception as e_pandas:
        print(f"⚠️  pandas.read_sas failed ({e_pandas}), trying pyreadstat…")

    # ── Method 2: pyreadstat fallback ─────────────────────────────────────────
    try:
        import pyreadstat  # type: ignore

        df, meta = pyreadstat.read_xpt(filepath)
        print(f"✅ Loaded with pyreadstat: {len(df):,} rows × {len(df.columns)} cols")
        print(f"   Variable labels: {list(meta.column_labels[:5])} …")
        return df
    except ImportError:
        print(
            "ERROR: pyreadstat not installed. Run:  pip install pyreadstat",
            file=sys.stderr,
        )
        sys.exit(1)
    except Exception as e_pyr:
        print(f"ERROR: pyreadstat also failed: {e_pyr}", file=sys.stderr)
        sys.exit(1)


def print_column_summary(df: pd.DataFrame) -> None:
    """Print column names and non-null counts for inspection."""
    print("\n── Column summary ──────────────────────────────────────────")
    for col in df.columns:
        non_null = df[col].notna().sum()
        dtype = df[col].dtype
        print(f"  {col:<20} dtype={str(dtype):<10} non_null={non_null:,}")
    print()


def save_outputs(df: pd.DataFrame, out_dir: str) -> None:
    """Save CSV and JSON outputs."""
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    csv_path = out_path / "CBC_J.csv"
    json_path = out_path / "CBC_J.json"

    # ── CSV ────────────────────────────────────────────────────────────────────
    df.to_csv(csv_path, index=False, float_format="%.4f")
    print(f"✅ CSV  saved → {csv_path}  ({csv_path.stat().st_size // 1024:,} KB)")

    # ── JSON (records orientation) ─────────────────────────────────────────────
    # round floats to 4 dp to keep file size manageable
    df_rounded = df.round(4)
    df_rounded.to_json(json_path, orient="records", indent=2)
    print(f"✅ JSON saved → {json_path}  ({json_path.stat().st_size // 1024:,} KB)")


def show_reference_ranges(df: pd.DataFrame) -> None:
    """
    Print population-level percentiles for key CBC variables.
    These can be used as reference ranges in the knowledge graph.
    Maps NHANES variable names → human-readable names.
    """
    nhanes_to_name = {
        "LBXWBCSI": "WBC (10^3/mcL)",
        "LBXRBCSI": "RBC (M/mcL)",
        "LBXHGB":   "Hemoglobin (g/dL)",
        "LBXHCT":   "Hematocrit (%)",
        "LBXMCVSI": "MCV (fL)",
        "LBXMC":    "MCH (pg)",
        "LBXMCHSI": "MCHC (g/dL)",
        "LBXRDW":   "RDW (%)",
        "LBXPLTSI": "Platelets (10^3/mcL)",
        "LBXMPSI":  "MPV (fL)",
        "LBXNRBC":  "NRBC (/100 WBC)",
    }

    print("\n── Population percentiles (NHANES 2017-2018 survey data) ──────")
    print(f"{'Test':<28} {'p2.5':>8} {'p25':>8} {'median':>8} {'p75':>8} {'p97.5':>8}")
    print("─" * 72)

    for var, name in nhanes_to_name.items():
        if var not in df.columns:
            continue
        col = df[var].dropna()
        if len(col) == 0:
            continue
        p = col.quantile([0.025, 0.25, 0.50, 0.75, 0.975])
        print(
            f"  {name:<26} "
            f"{p[0.025]:>8.2f} {p[0.25]:>8.2f} {p[0.50]:>8.2f} "
            f"{p[0.75]:>8.2f} {p[0.975]:>8.2f}"
        )
    print()


def main():
    parser = argparse.ArgumentParser(description="Convert CBC_J.xpt → CSV + JSON")
    parser.add_argument(
        "--input",
        default="data/CBC_J.xpt",
        help="Path to CBC_J.xpt (default: data/CBC_J.xpt)",
    )
    parser.add_argument(
        "--out-dir",
        default="data",
        help="Output directory for CSV and JSON (default: data/)",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print column summary and reference range percentiles",
    )
    args = parser.parse_args()

    print(f"\n🔬 Converting: {args.input}")
    df = load_xpt(args.input)

    if args.summary:
        print_column_summary(df)
        show_reference_ranges(df)
    else:
        show_reference_ranges(df)

    save_outputs(df, args.out_dir)
    print("\n✅ Conversion complete. Files ready in:", args.out_dir)


if __name__ == "__main__":
    main()
