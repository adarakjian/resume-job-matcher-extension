// Minimal type declaration for the chrome.tabs API used below, so this
// compiles without needing the full @types/chrome package installed.
declare const chrome: {
  tabs: {
    create: (options: { url: string; active: boolean }) => void;
  };
};

// CONFIG comes from config.js, loaded via a <script> tag in popup.html before this file
declare const CONFIG: {
  ADZUNA_APP_ID: string;
  ADZUNA_APP_KEY: string;
  ADZUNA_COUNTRY: string;
};

// A small list of common job-title and skill keywords to scan a resume for.
// This is a simple local stand-in for AI-based extraction — no external
// API call, no cost, and fully transparent logic.
const KNOWN_TITLES = [
  "technical support", "customer support", "help desk", "support specialist",
  "support engineer", "software engineer", "developer", "product manager",
  "project manager", "data analyst", "qa engineer", "systems administrator",
  "it support", "network administrator", "devops", "customer success"
];

const KNOWN_SKILLS = [
  "sql", "typescript", "javascript", "python", "java", "zendesk", "jira",
  "excel", "salesforce", "aws", "linux", "networking", "troubleshooting",
  "api", "rest", "git", "html", "css", "react", "node", "agile", "scrum",
  "customer service", "ticketing", "on-call", "debugging"
];

interface ResumeSummary {
  job_titles: string[];
  top_skills: string[];
  experience_level: string;
  search_keywords: string;
}

interface AdzunaJob {
  title: string;
  company: { display_name: string };
  redirect_url: string;
  location: { display_name: string };
}

const resumeInput = document.getElementById("resumeInput") as HTMLTextAreaElement;
const analyzeBtn = document.getElementById("analyzeBtn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const resultsEl = document.getElementById("results") as HTMLDivElement;

analyzeBtn.addEventListener("click", async () => {
  const resumeText = resumeInput.value.trim();
  if (!resumeText) {
    setStatus("Please paste your resume text first.");
    return;
  }

  if (!configLooksValid()) {
    setStatus("Adzuna API keys aren't set up yet — check config.js.");
    return;
  }

  try {
    setBusy(true);
    setStatus("Scanning resume for titles and skills...");
    const summary = analyzeResumeLocally(resumeText);

    setStatus(`Searching for: ${summary.search_keywords}`);
    const jobs = dedupeJobs(await searchJobs(summary.search_keywords));

    renderJobs(jobs.slice(0, 10));
    setStatus(`Found ${jobs.length} matches. Showing top ${Math.min(10, jobs.length)}.`);
  } catch (err) {
    console.error(err);
    setStatus("Something went wrong. Check the console for details.");
  } finally {
    setBusy(false);
  }
});

/**
 * Quick sanity check that config.js was actually filled in, rather than
 * left as the placeholder values from config.example.js. Catches the most
 * common setup mistake (forgetting to add real keys) with a clear message
 * instead of letting it fail later as a confusing network error.
 */
function configLooksValid(): boolean {
  if (typeof CONFIG === "undefined") return false;
  const placeholderValues = ["app id", "app key", "your-adzuna-app-id-here", "your-adzuna-app-key-here"];
  return (
    Boolean(CONFIG.ADZUNA_APP_ID) &&
    Boolean(CONFIG.ADZUNA_APP_KEY) &&
    !placeholderValues.includes(CONFIG.ADZUNA_APP_ID) &&
    !placeholderValues.includes(CONFIG.ADZUNA_APP_KEY)
  );
}

/**
 * Scans resume text for known job titles and skills, and makes a rough
 * guess at experience level based on seniority words or a "N years"
 * pattern. This is a simple local stand-in for AI-based extraction.
 */
function analyzeResumeLocally(resumeText: string): ResumeSummary {
  const lowerText = resumeText.toLowerCase();

  const foundTitles = KNOWN_TITLES.filter((title) => lowerText.includes(title));
  const foundSkills = KNOWN_SKILLS.filter((skill) => lowerText.includes(skill));

  // Rough experience-level guess based on years mentioned or seniority words
  let experienceLevel = "mid";
  const yearsMatch = lowerText.match(/(\d+)\+?\s+years?/);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : null;
  if (lowerText.includes("senior") || lowerText.includes("lead") || (years !== null && years >= 5)) {
    experienceLevel = "senior";
  } else if (lowerText.includes("junior") || lowerText.includes("entry") || (years !== null && years <= 1)) {
    experienceLevel = "entry";
  }

  const bestTitle = foundTitles[0] || "technical support";
  const bestSkill = foundSkills[0] || "";
  const searchKeywords = [bestTitle, bestSkill].filter(Boolean).join(" ");

  return {
    job_titles: foundTitles.length ? foundTitles : [bestTitle],
    top_skills: foundSkills,
    experience_level: experienceLevel,
    search_keywords: searchKeywords
  };
}

/**
 * Queries the Adzuna job search API for listings matching the given
 * keywords and returns the raw results array.
 */
async function searchJobs(keywords: string): Promise<AdzunaJob[]> {
  const country = CONFIG.ADZUNA_COUNTRY || "us";
  const url =
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
    `?app_id=${CONFIG.ADZUNA_APP_ID}` +
    `&app_key=${CONFIG.ADZUNA_APP_KEY}` +
    `&results_per_page=20` +
    `&what=${encodeURIComponent(keywords)}` +
    `&content-type=application/json`;

  const response = await fetch(url);
  const data = await response.json();
  return (data.results || []) as AdzunaJob[];
}

/**
 * Adzuna sometimes returns near-duplicate postings from different
 * aggregators pointing at the same underlying listing. This keeps only
 * the first job seen for each unique redirect URL.
 */
function dedupeJobs(jobs: AdzunaJob[]): AdzunaJob[] {
  const seen = new Set<string>();
  const unique: AdzunaJob[] = [];
  for (const job of jobs) {
    if (seen.has(job.redirect_url)) continue;
    seen.add(job.redirect_url);
    unique.push(job);
  }
  return unique;
}

/**
 * Renders a list of job cards into the results container. Each card's
 * link opens in a background tab (rather than following the href
 * directly) so the popup doesn't lose focus and auto-close.
 */
function renderJobs(jobs: AdzunaJob[]) {
  resultsEl.innerHTML = "";
  if (jobs.length === 0) {
    resultsEl.innerHTML = `<div class="job-card">No matches found. Try a different resume or check back later.</div>`;
    return;
  }

  for (const job of jobs) {
    const card = document.createElement("div");
    card.className = "job-card";
    card.innerHTML = `
      <div class="job-title">${escapeHtml(job.title)}</div>
      <div class="job-company">${escapeHtml(job.company?.display_name || "Unknown company")} — ${escapeHtml(job.location?.display_name || "")}</div>
      <a class="job-link" href="#">View listing →</a>
    `;

    const link = card.querySelector(".job-link") as HTMLAnchorElement;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: job.redirect_url, active: false });
    });

    resultsEl.appendChild(card);
  }
}

/** Escapes a string for safe insertion into innerHTML. */
function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function setStatus(msg: string) {
  statusEl.textContent = msg;
}

/** Toggles the busy state: disables input, updates button text. */
function setBusy(busy: boolean) {
  analyzeBtn.disabled = busy;
  resumeInput.disabled = busy;
  analyzeBtn.textContent = busy ? "Working..." : "Find Matching Jobs";
}