# Communication

- Communicates in casual, informal Indonesian (uses "gw", "lu", "cuy", "bos", "jir"), often mixing in English tech terms; replies should match that register. Confidence: 0.98
- Describes problems with screenshots or precise details (page, person's name, date, shift, observed value) and asks to check the page directly; expects the agent to investigate and fix issues rather than ask clarifying questions first. Confidence: 0.8
- When reporting a UI problem, explicitly invites design suggestions/alternatives ("ada saran desain lagi ga?") and expects the agent to propose options (e.g., badge variants, hiding the column on mobile) alongside the applied fix. Confidence: 0.55
- Works in a terminal CLI that cannot paste screenshots ("di terminal ga bisa kasih screenshot"); when visual feedback on a UI issue is needed, expects it to be shared via a file path the agent can read, or the agent capturing its own screenshot (e.g., via agent-browser). In practice, saves screenshots to the Desktop and references them by filename (e.g., "coba cek di desktop-local nama file nya ss") for the agent to read. Confidence: 0.7
