"use strict";
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
const resumeInput = document.getElementById("resumeInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
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
    }
    catch (err) {
        console.error(err);
        setStatus("Something went wrong. Check the console for details.");
    }
    finally {
        setBusy(false);
    }
});
function configLooksValid() {
    if (typeof CONFIG === "undefined")
        return false;
    const placeholderValues = ["app id", "app key", "your-adzuna-app-id-here", "your-adzuna-app-key-here"];
    return (Boolean(CONFIG.ADZUNA_APP_ID) &&
        Boolean(CONFIG.ADZUNA_APP_KEY) &&
        !placeholderValues.includes(CONFIG.ADZUNA_APP_ID) &&
        !placeholderValues.includes(CONFIG.ADZUNA_APP_KEY));
}
function analyzeResumeLocally(resumeText) {
    const lowerText = resumeText.toLowerCase();
    const foundTitles = KNOWN_TITLES.filter((title) => lowerText.includes(title));
    const foundSkills = KNOWN_SKILLS.filter((skill) => lowerText.includes(skill));
    // Rough experience-level guess based on years mentioned or seniority words
    let experienceLevel = "mid";
    const yearsMatch = lowerText.match(/(\d+)\+?\s+years?/);
    const years = yearsMatch ? parseInt(yearsMatch[1], 10) : null;
    if (lowerText.includes("senior") || lowerText.includes("lead") || (years !== null && years >= 5)) {
        experienceLevel = "senior";
    }
    else if (lowerText.includes("junior") || lowerText.includes("entry") || (years !== null && years <= 1)) {
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
async function searchJobs(keywords) {
    const country = CONFIG.ADZUNA_COUNTRY || "us";
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
        `?app_id=${CONFIG.ADZUNA_APP_ID}` +
        `&app_key=${CONFIG.ADZUNA_APP_KEY}` +
        `&results_per_page=20` +
        `&what=${encodeURIComponent(keywords)}` +
        `&content-type=application/json`;
    const response = await fetch(url);
    const data = await response.json();
    return (data.results || []);
}
function dedupeJobs(jobs) {
    const seen = new Set();
    const unique = [];
    for (const job of jobs) {
        if (seen.has(job.redirect_url))
            continue;
        seen.add(job.redirect_url);
        unique.push(job);
    }
    return unique;
}
function renderJobs(jobs) {
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
        const link = card.querySelector(".job-link");
        link.addEventListener("click", (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: job.redirect_url, active: false });
        });
        resultsEl.appendChild(card);
    }
}
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
function setStatus(msg) {
    statusEl.textContent = msg;
}
function setBusy(busy) {
    analyzeBtn.disabled = busy;
    resumeInput.disabled = busy;
    analyzeBtn.textContent = busy ? "Working..." : "Find Matching Jobs";
}