# Resume Job Matcher

A Chrome extension that scans a pasted resume for known job-title and skill
keywords, then returns the top matching job listings from the Adzuna job
search API.

## Why I built this

I wanted a hands-on project to get real experience with TypeScript, working
with an external API, and handling structured JSON responses — skills that
come up constantly in my day-to-day technical support work when I'm tracing
issues through logs, APIs, and system integrations.

## How it works

1. Paste resume text into the popup.
2. The extension scans the text locally against a list of known job titles
   and skills, and makes a rough guess at experience level (based on
   seniority words and years-of-experience mentions).
3. The best-matching title and skill are combined into a search query sent
   to the Adzuna job search API.
4. The top 5 matching listings are displayed with title, company, location,
   and a direct link.

## Tech used

- TypeScript (compiled to plain JS with `tsc`)
- Chrome Extension Manifest V3
- Adzuna Job Search API

## Setup

1. Clone this repo.
2. Copy `config.example.js` to `config.js` and fill in your own Adzuna
   `app_id` and `app_key` from [developer.adzuna.com](https://developer.adzuna.com)
3. Compile TypeScript: `tsc`
4. In Chrome, go to `chrome://extensions`, enable Developer mode, click
   "Load unpacked", and select this folder.

## Notes

- `config.js` is git-ignored so API keys are never committed.
- This project only searches legitimate job board listings via Adzuna's
  public API — no scraping of platforms that prohibit it.

## Possible next steps

- Cache Adzuna results to avoid redundant API calls
- Let the user pick which job title to search if multiple are detected
- Add PDF upload/parsing instead of paste-only input
- Swap the local keyword scan for an AI-based analysis (e.g. via the
  Claude API) for smarter extraction from less structured resumes
