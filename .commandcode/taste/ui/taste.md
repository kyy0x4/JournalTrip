# UI

- Prefers pagination or separate pages to switch between multiple charts on a dashboard rather than stacking all charts on one view. Confidence: 0.7
- Prefers hiding or blurring chart data until the user selects a required filter first (progressive disclosure), e.g., pick a customer before seeing per-driver data. Confidence: 0.6
- For multi-month date ranges selected in charts, prefers aggregating per month (e.g., Jan–Jun shows monthly bars) rather than per individual date. Confidence: 0.65
- Prefers explicit unit symbols on displays, e.g., showing "%" on percentage values like normal/hypertension/hypotension percentages. Confidence: 0.6
- When a chart's x-axis is a driver name, wants the ability to switch/cycle views within the same chart component (e.g., blood pressure analysis per driver). Confidence: 0.6
- In trend/line charts, days with no data should be treated as gaps that the line connects across smoothly (e.g., `connectNulls` with null values) rather than dropping the line to 0 — an empty day should not create a valley in the trend; the user re-checks the rendered chart after a fix and reports back ("masih ada lembah... coba cek") if a valley still appears, so the fix must truly eliminate it. Confidence: 0.8
