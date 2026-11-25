import asyncio
import os
import urllib.robotparser
import uuid
from typing import Dict, List, Optional

from bs4 import BeautifulSoup
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scraper import (
    DeepFetchEngine,
    HEADERS,
    MAX_PAGES_CAP,
    MAX_PROFILES_CAP,
    SOCIAL_PATTERNS,
    detect_available_categories,
    extract_profile_links,
    fix_text,
    normalize_url,
    parse_page_deep,
)

app = FastAPI(title="ALM Nexus Web Data Engine", version="1.0.0")

allowed_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "https://almnexus.tech,http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: Dict[str, dict] = {}


class InspectRequest(BaseModel):
  url: str


class CrawlRequest(BaseModel):
  url: str
  categories: Optional[List[str]] = None
  max_pages: int = Field(default=1, ge=1, le=MAX_PAGES_CAP)
  crawl_profiles: bool = True
  max_profiles: int = Field(default=15, ge=1, le=MAX_PROFILES_CAP)


@app.get("/health")
async def health():
  return {"status": "ok", "engine": "ALM Nexus Deep Web Data Engine"}


@app.post("/api/v1/inspect")
async def inspect_site(req: InspectRequest):
  try:
    url, domain, _ = normalize_url(req.url)
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))

  fetcher = DeepFetchEngine(concurrency=2)
  try:
    html_text, used_browser = await fetcher.fetch_html(
        url, allow_scroll=True, scroll_steps=3
    )
    if not html_text:
      raise HTTPException(
          status_code=502, detail="Unable to fetch content from target URL."
      )
    detected, found_socials = detect_available_categories(
        html_text, url, domain
    )
    return {
        "url": url,
        "domain": domain,
        "rendered_with_browser": used_browser,
        "suggested_categories": detected,
        "detected_socials": found_socials,
    }
  finally:
    await fetcher.close()


async def execute_crawl_job(job_id: str, req: CrawlRequest):
  job = JOBS[job_id]
  job["status"] = "running"
  fetcher = DeepFetchEngine(concurrency=3)

  try:
    url, domain, origin = normalize_url(req.url)
    first_html, used_browser = await fetcher.fetch_html(
        url, allow_scroll=True, scroll_steps=5
    )
    if not first_html:
      job["status"] = "failed"
      job["error"] = "Target website returned empty HTML."
      return

    detected, found_socials = detect_available_categories(
        first_html, url, domain
    )
    chosen = set(req.categories) if req.categories else set(detected)
    if req.crawl_profiles and "directory_profiles" in detected:
      chosen.add("directory_profiles")

    all_rows = []
    all_rows.extend(
        await parse_page_deep(
            1,
            url,
            first_html,
            domain,
            chosen,
            found_socials,
            fetcher=fetcher,
            deep_book_details=("books" in chosen),
        )
    )
    job["pages_crawled"] = 1
    job["progress"] = 35

    # Pagination
    if req.max_pages > 1 and not used_browser:
      rp = urllib.robotparser.RobotFileParser()
      rp.set_url(f"{origin}/robots.txt")
      try:
        rp.read()
      except Exception:
        rp = None

      clean_base = url.rstrip("/")
      targets = []
      for p_num in range(2, req.max_pages + 1):
        if "books.toscrape.com" in clean_base:
          next_u = (
              f"{clean_base}/page-{p_num}.html"
              if "/catalogue/" in clean_base
              else f"{clean_base}/catalogue/page-{p_num}.html"
          )
        elif (
            "quotes.toscrape.com" in clean_base
            and "/scroll" not in clean_base
            and "/js" not in clean_base
        ):
          next_u = f"{clean_base}/page/{p_num}/"
        else:
          sep = "&" if "?" in url else "?"
          next_u = f"{url}{sep}page={p_num}"

        if rp is None or rp.can_fetch(HEADERS["User-Agent"], next_u):
          targets.append((p_num, next_u))

      async def worker_page(pn, pu):
        h_txt, _ = await fetcher.fetch_html(pu, allow_scroll=False)
        if not h_txt:
          return []
        return await parse_page_deep(
            pn,
            pu,
            h_txt,
            domain,
            chosen,
            found_socials,
            fetcher=fetcher,
            deep_book_details=("books" in chosen),
        )

      batches = await asyncio.gather(
          *(worker_page(pn, pu) for pn, pu in targets)
      )
      for b in batches:
        all_rows.extend(b)
      job["pages_crawled"] += len(targets)

    job["progress"] = 70

    # Directory / Profile Deep Crawl
    if "directory_profiles" in chosen:
      profile_urls = extract_profile_links(
          first_html, url, domain, limit=req.max_profiles
      )
      if profile_urls:
        profile_fields = chosen | {
            "business_emails",
            "personal_emails",
            "phones",
            "whatsapp",
            "socials",
            "meta_info",
        }

        async def worker_profile(idx, pu):
          p_html, _ = await fetcher.fetch_html(pu, allow_scroll=False)
          if not p_html:
            return []
          p_soup = BeautifulSoup(p_html, "html.parser")
          h1_el = p_soup.find(["h1", "h2"])
          p_name = fix_text(
              h1_el.get_text(" ", strip=True)
              if h1_el
              else (p_soup.title.get_text(strip=True) if p_soup.title else "")
          )
          return await parse_page_deep(
              idx,
              pu,
              p_html,
              domain,
              profile_fields,
              list(SOCIAL_PATTERNS.keys()),
              fetcher=None,
              profile_name=p_name,
              deep_book_details=False,
          )

        prof_batches = await asyncio.gather(
            *(
                worker_profile(i, pu)
                for i, pu in enumerate(profile_urls, start=1)
            )
        )
        for pb in prof_batches:
          all_rows.extend(pb)
        job["pages_crawled"] += len(profile_urls)

    # Deduplicate rows cleanly
    seen_keys = set()
    unique_rows = []
    for r in all_rows:
      sig = tuple(sorted((k, str(v)) for k, v in r.items()))
      if sig not in seen_keys:
        seen_keys.add(sig)
        unique_rows.append(r)

    job["results"] = unique_rows
    job["total_records"] = len(unique_rows)
    job["progress"] = 100
    job["status"] = "completed"

  except Exception as e:
    job["status"] = "failed"
    job["error"] = str(e)
  finally:
    await fetcher.close()


@app.post("/api/v1/crawl")
async def start_crawl(req: CrawlRequest, background_tasks: BackgroundTasks):
  try:
    normalize_url(req.url)
  except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))

  job_id = str(uuid.uuid4())
  JOBS[job_id] = {
      "job_id": job_id,
      "status": "queued",
      "progress": 5,
      "pages_crawled": 0,
      "total_records": 0,
      "results": [],
      "error": None,
  }
  background_tasks.add_task(execute_crawl_job, job_id, req)
  return {"job_id": job_id, "status": "queued"}


@app.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: str):
  if job_id not in JOBS:
    raise HTTPException(status_code=404, detail="Job not found")
  return JOBS[job_id]
