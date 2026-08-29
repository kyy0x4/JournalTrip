# Database

- Prefers adding new columns to the database schema to store new data fields (e.g., tension factor, hypertension reason) rather than using workarounds. Confidence: 0.65
- Tracks the database schema closely; expects data already present in the DB to appear in the UI, and treats missing display of existing DB data as a bug to diagnose. Confidence: 0.6
- Keeps multiple years of the same dataset (e.g., 2025 and 2026 KR reports) in the same table, distinguished by date, syncing from per-year Google Sheets that share identical column structure, rather than splitting into separate tables per year. Confidence: 0.55
- For Google Sheets → Supabase sync scripts, uses delete-then-insert scoped to the sheet's date range (to avoid duplicates) plus batched inserts (e.g., 500 rows per request) to stay within Apps Script execution time limits. Confidence: 0.5
