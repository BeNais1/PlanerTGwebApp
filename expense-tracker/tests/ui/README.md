# Local UI fixtures

Run `npx vite --config tests/ui/vite.config.mjs` from expense-tracker, then open http://127.0.0.1:5178/tests/ui/index.html.

This separate Vite configuration replaces database operations with synthetic fixtures. It is never imported by the production entry. Do not use real account data here. Append `?theme=dark` for dark mode. OCR uses the actual browser worker.
