import asyncio
import ipaddress
import re
import socket
import urllib.robotparser
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

BUSINESS_PREFIXES = {
    "info",
    "contact",
    "sales",
    "support",
    "hello",
    "office",
    "enquiries",
    "service",
    "marketing",
    "admin",
    "team",
    "press",
    "media",
    "billing",
    "careers",
    "hr",
}

SOCIAL_PATTERNS = {
    "Instagram": r"(?:https?://)?(?:www\.)?instagram\.com/[A-Za-z0-9._-]+/?",
    "YouTube": (
        r"(?:https?://)?(?:www\.|m\.)?"
        r"(?:youtube\.com/(?:@|channel/|c/|user/|watch\?v=)[A-Za-z0-9._-]+|youtu\.be/[A-Za-z0-9._-]+)"
    ),
    "Twitter/X": (
        r"(?:https?://)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)/[A-Za-z0-9_]+/?"
    ),
    "Facebook": (
        r"(?:https?://)?(?:www\.|m\.)?facebook\.com/[A-Za-z0-9._-]+/?"
    ),
    "TikTok": r"(?:https?://)?(?:www\.|m\.)?tiktok\.com/@[A-Za-z0-9._-]+/?",
    "LinkedIn": (
        r"(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/[A-Za-z0-9._-]+/?"
    ),
}

WHATSAPP_PATTERN = (
    r"(?:https?://)?(?:wa\.me/\d+|api\.whatsapp\.com/send\?[^\s\"'<>]+)"
)

PROFILE_KEYWORDS = (
    "location",
    "locations",
    "shop",
    "shops",
    "store",
    "stores",
    "listing",
    "listings",
    "profile",
    "profiles",
    "place",
    "places",
    "cafe",
    "coffee",
    "detail",
    "details",
    "item",
    "vendor",
    "branch",
)

SKIP_PATH_KEYWORDS = (
    "login",
    "signin",
    "signup",
    "register",
    "cart",
    "checkout",
    "privacy",
    "terms",
    "policy",
    "faq",
    "help",
    "cookie",
)

SKIP_EXTERNAL_DOMAINS = (
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
    "tiktok.com",
    "linkedin.com",
    "wa.me",
    "whatsapp.com",
    "google.com",
    "apple.com",
    "play.google.com",
)

RATING_MAP = {
    "One": "1/5",
    "Two": "2/5",
    "Three": "3/5",
    "Four": "4/5",
    "Five": "5/5",
}

MAX_PAGES_CAP = 20
MAX_PROFILES_CAP = 25


def fix_text(val: str) -> str:
  if not isinstance(val, str) or not val:
    return ""
  try:
    return val.encode("latin1").decode("utf-8").strip()
  except Exception:
    return val.replace("Â£", "£").strip()


def clean_email(email: str):
  email = email.strip().strip(".,;:()[]<>\"'").lower()
  if email.endswith(
      (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js")
  ):
    return None
  return email


def clean_url_item(u: str) -> str:
  return u.strip().rstrip(".,;)\"'/")


def is_safe_public_host(hostname: str) -> bool:
  if not hostname or hostname in {"localhost", "127.0.0.1", "0.0.0.0"}:
    return False
  try:
    infos = socket.getaddrinfo(hostname, None)
    for info in infos:
      ip_obj = ipaddress.ip_address(info[4][0])
      if (
          ip_obj.is_private
          or ip_obj.is_loopback
          or ip_obj.is_link_local
          or ip_obj.is_reserved
          or ip_obj.is_multicast
      ):
        return False
    return True
  except Exception:
    return False


def normalize_url(website: str):
  website = website.strip()
  if not website.startswith(("https://", "http://")):
    website = "https://" + website
  parsed = urlparse(website)
  domain = parsed.netloc.lower().split(":")[0]
  if not is_safe_public_host(domain):
    raise ValueError("Invalid or restricted/private URL.")
  return website, domain, f"{parsed.scheme}://{parsed.netloc.lower()}"


class DeepFetchEngine:

  def __init__(self, concurrency: int = 3):
    self.semaphore = asyncio.Semaphore(concurrency)
    self._pw = None
    self._browser = None
    self._context = None
    self._browser_lock = asyncio.Lock()

  async def _get_context(self):
    async with self._browser_lock:
      if self._browser is None:
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=True)
        self._context = await self._browser.new_context(
            user_agent=HEADERS["User-Agent"]
        )
      return self._context

  def _sync_get(self, url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    if "text/html" not in resp.headers.get("Content-Type", ""):
      return ""
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text

  async def fetch_html(
      self, url: str, allow_scroll: bool = True, scroll_steps: int = 4
  ):
    async with self.semaphore:
      html_text = ""
      used_browser = False

      try:
        html_text = await asyncio.to_thread(self._sync_get, url)
      except Exception:
        html_text = ""

      soup = BeautifulSoup(html_text, "html.parser")
      plain_len = len(soup.get_text(" ", strip=True))
      has_known_cards = bool(
          soup.select("div.quote, article.product_pod, span.text, p.price_color")
      )
      is_scroll_endpoint = "/scroll" in url.lower() or "/js" in url.lower()

      if (
          (not html_text or plain_len < 120) and not has_known_cards
      ) or is_scroll_endpoint:
        try:
          ctx = await self._get_context()
          page = await ctx.new_page()
          try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1000)
            if allow_scroll:
              for _ in range(scroll_steps):
                prev_h = await page.evaluate("document.body.scrollHeight")
                await page.evaluate(
                    "window.scrollTo(0, document.body.scrollHeight)"
                )
                await page.wait_for_timeout(900)
                new_h = await page.evaluate("document.body.scrollHeight")
                if new_h == prev_h:
                  break
            html_text = await page.content()
            used_browser = True
          finally:
            await page.close()
        except Exception:
          pass

      await asyncio.sleep(0.4)
      return html_text, used_browser

  async def close(self):
    if self._context is not None:
      await self._context.close()
      self._context = None
    if self._browser is not None:
      await self._browser.close()
      self._browser = None
    if self._pw is not None:
      await self._pw.stop()
      self._pw = None


def extract_profile_links(
    html_text: str, base_url: str, domain: str, limit: int = 15
):
  soup = BeautifulSoup(html_text, "html.parser")
  base_clean = base_url.rstrip("/").lower()
  found = []
  seen = set()

  for a in soup.find_all("a", href=True):
    full_url = urljoin(base_url, a["href"]).split("#")[0].rstrip("/")
    if not full_url or full_url.lower() == base_clean:
      continue
    parsed = urlparse(full_url)
    if parsed.netloc.lower().split(":")[0] != domain:
      continue
    path_l = parsed.path.lower()
    if any(bad in path_l for bad in SKIP_PATH_KEYWORDS):
      continue
    is_deeper = len([seg for seg in path_l.split("/") if seg]) >= 3
    has_kw = any(kw in path_l for kw in PROFILE_KEYWORDS)
    if (is_deeper or has_kw) and full_url not in seen:
      seen.add(full_url)
      found.append(full_url)
      if len(found) >= limit:
        break
  return found


def extract_external_websites(hrefs, own_domain: str):
  ext = set()
  for h in hrefs:
    if not h.startswith(("http://", "https://")):
      continue
    host = urlparse(h).netloc.lower().split(":")[0]
    if not host or host == own_domain:
      continue
    if any(skip in host for skip in SKIP_EXTERNAL_DOMAINS):
      continue
    ext.add(clean_url_item(h))
  return sorted(ext)[:3]


def detect_available_categories(html_text: str, url: str, domain: str):
  soup = BeautifulSoup(html_text, "html.parser")
  text_content = fix_text(soup.get_text(" ", strip=True))
  hrefs = [urljoin(url, a["href"]) for a in soup.find_all("a", href=True)]
  combined = text_content + " " + " ".join(hrefs)

  detected = []
  if soup.select("div.quote"):
    detected.append("quotes")
  if soup.select("article.product_pod"):
    detected.append("books")

  raw_emails = {
      e
      for e in (
          clean_email(x)
          for x in re.findall(
              r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", combined
          )
      )
      if e is not None
  }
  if any(
      e.split("@")[0].split("+")[0] in BUSINESS_PREFIXES for e in raw_emails
  ):
    detected.append("business_emails")
  if any(
      e.split("@")[0].split("+")[0] not in BUSINESS_PREFIXES for e in raw_emails
  ):
    detected.append("personal_emails")

  raw_phones = [
      p
      for p in re.findall(r"\+?\d[\d\s().-]{7,}\d", text_content)
      if len(re.sub(r"\D", "", p)) >= 8
  ]
  if raw_phones or any(h.lower().startswith("tel:") for h in hrefs):
    detected.append("phones")

  if re.findall(WHATSAPP_PATTERN, combined, flags=re.IGNORECASE):
    detected.append("whatsapp")

  found_socials = []
  for net, pat in SOCIAL_PATTERNS.items():
    if re.findall(pat, combined, flags=re.IGNORECASE):
      found_socials.append(net)
  if found_socials:
    detected.append("socials")

  meta_desc = soup.find("meta", attrs={"name": re.compile("description", re.I)})
  if meta_desc and meta_desc.get("content", "").strip():
    detected.append("meta_info")

  if extract_profile_links(html_text, url, domain, limit=5):
    detected.append("directory_profiles")

  if soup.find_all("img", src=True):
    detected.append("images")

  if not detected:
    detected = ["meta_info", "business_emails", "phones", "socials", "images"]

  return detected, found_socials


def extract_author_from_book_html(book_html: str, fallback_card_soup):
  if book_html:
    s = BeautifulSoup(book_html, "html.parser")
    meta_author = s.find("meta", attrs={"name": re.compile("author", re.I)})
    if meta_author and meta_author.get("content"):
      return fix_text(meta_author["content"])
    for tag in s.find_all(["th", "td", "span", "p", "div"]):
      txt = tag.get_text(" ", strip=True).lower()
      if "author" in txt and len(txt) < 40:
        nxt = tag.find_next_sibling()
        if nxt and nxt.get_text(" ", strip=True):
          return fix_text(nxt.get_text(" ", strip=True))
  card_text = fallback_card_soup.get_text(" ", strip=True)
  m = re.search(r"\bby\s+([A-Z][A-Za-z0-9 .'-]{1,40})", card_text)
  return fix_text(m.group(1)) if m else "Not Listed"


async def parse_page_deep(
    page_num: int,
    url: str,
    html_text: str,
    domain: str,
    selected: set,
    socials_list: list,
    fetcher=None,
    profile_name: str = "",
    deep_book_details: bool = True,
):
  rows = []
  soup = BeautifulSoup(html_text, "html.parser")
  title = fix_text(soup.title.get_text(strip=True) if soup.title else domain)
  text_content = fix_text(soup.get_text(" ", strip=True))
  hrefs = [urljoin(url, a["href"]) for a in soup.find_all("a", href=True)]
  combined = text_content + " " + " ".join(hrefs)

  if "quotes" in selected:
    for q in soup.select("div.quote"):
      txt_el = q.select_one("span.text")
      auth_el = q.select_one("small.author")
      tag_els = q.select("div.tags a.tag")
      rows.append({
          "Category": "Quote",
          "Page #": page_num,
          "Website": domain,
          "Quote": fix_text(txt_el.get_text(strip=True)) if txt_el else "",
          "Author": fix_text(auth_el.get_text(strip=True)) if auth_el else "",
          "Tags": ", ".join(
              fix_text(t.get_text(strip=True)) for t in tag_els
          ),
          "Source Page": clean_url_item(url),
      })

  if "books" in selected:
    cards = soup.select("article.product_pod")
    book_items = []
    for card in cards:
      a_tag = card.select_one("h3 a")
      img_tag = card.select_one("img")
      price_tag = card.select_one("p.price_color")
      avail_tag = card.select_one("p.instock.availability")
      rating_tag = card.select_one("p.star-rating")

      rating = ""
      if rating_tag:
        for cls in rating_tag.get("class", []):
          if cls in RATING_MAP:
            rating = RATING_MAP[cls]
            break

      b_title = fix_text(
          a_tag.get("title", "").strip()
          or (a_tag.get_text(strip=True) if a_tag else "")
      )
      b_link = (
          clean_url_item(urljoin(url, a_tag["href"]))
          if a_tag and a_tag.get("href")
          else ""
      )
      img_u = (
          clean_url_item(urljoin(url, img_tag["src"]))
          if img_tag and img_tag.get("src")
          else ""
      )
      price = fix_text(price_tag.get_text(strip=True)) if price_tag else ""
      avail = (
          fix_text(avail_tag.get_text(" ", strip=True)) if avail_tag else ""
      )
      book_items.append((card, b_title, b_link, img_u, price, avail, rating))

    async def resolve_book(item):
      card, b_title, b_link, img_u, price, avail, rating = item
      b_html = ""
      if deep_book_details and fetcher is not None and b_link:
        b_html, _ = await fetcher.fetch_html(b_link, allow_scroll=False)
      author = extract_author_from_book_html(b_html, card)
      return {
          "Category": "Book",
          "Page #": page_num,
          "Website": domain,
          "Book Title": b_title,
          "Author": author,
          "Price": price,
          "Availability": avail,
          "Rating": rating,
          "Image URL": img_u,
          "Book URL": b_link,
          "Source Page": clean_url_item(url),
      }

    if book_items:
      rows.extend(await asyncio.gather(*(resolve_book(it) for it in book_items)))

  if "images" in selected:
    for img in soup.find_all("img", src=True):
      rows.append({
          "Category": "Image",
          "Page #": page_num,
          "Website": domain,
          "Alt Text": fix_text(img.get("alt", "").strip()),
          "Image URL": clean_url_item(urljoin(url, img["src"])),
          "Source Page": clean_url_item(url),
      })

  c_row = {
      "Category": "Profile / Contact" if profile_name else "Contact / Social",
      "Page #": page_num,
      "Website": domain,
      "Page Title": title,
  }
  if profile_name:
    c_row["Profile / Shop Name"] = profile_name[:120]

  has_c = False

  if "meta_info" in selected:
    meta_desc = soup.find("meta", attrs={"name": re.compile("description", re.I)})
    desc_val = (
        fix_text(meta_desc["content"])
        if meta_desc and meta_desc.get("content")
        else ""
    )
    if desc_val:
      c_row["Meta Description"] = desc_val
      has_c = True

  if profile_name:
    ext_sites = extract_external_websites(hrefs, domain)
    if ext_sites:
      c_row["Official External Website"] = ", ".join(ext_sites)
      has_c = True

  if "business_emails" in selected or "personal_emails" in selected:
    raw_emails = {
        e
        for e in (
            clean_email(x)
            for x in re.findall(
                r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", combined
            )
        )
        if e is not None
    }
    for h in hrefs:
      if h.lower().startswith("mailto:"):
        cleaned_m = clean_email(h.split(":", 1)[1].split("?")[0])
        if cleaned_m:
          raw_emails.add(cleaned_m)

    biz = sorted(
        e
        for e in raw_emails
        if e.split("@")[0].split("+")[0] in BUSINESS_PREFIXES
    )
    pers = sorted(
        e
        for e in raw_emails
        if e.split("@")[0].split("+")[0] not in BUSINESS_PREFIXES
    )

    if "business_emails" in selected and biz:
      c_row["Business Emails"] = ", ".join(biz)
      has_c = True
    if "personal_emails" in selected and pers:
      c_row["Personal Emails"] = ", ".join(pers)
      has_c = True

  if "phones" in selected:
    phones = {
        re.sub(r"\s+", " ", p.strip())
        for p in re.findall(r"\+?\d[\d\s().-]{7,}\d", text_content)
        if len(re.sub(r"\D", "", p)) >= 8
    }
    for h in hrefs:
      if h.lower().startswith("tel:"):
        t_num = h.split(":", 1)[1].split("?")[0].strip()
        if len(re.sub(r"\D", "", t_num)) >= 8:
          phones.add(t_num)
    if phones:
      c_row["Phone Numbers"] = ", ".join(sorted(phones))
      has_c = True

  if "whatsapp" in selected:
    wa_links = sorted({
        clean_url_item(w)
        for w in re.findall(WHATSAPP_PATTERN, combined, flags=re.IGNORECASE)
    })
    if wa_links:
      c_row["WhatsApp"] = ", ".join(wa_links)
      has_c = True

  if "socials" in selected:
    nets = socials_list if socials_list else list(SOCIAL_PATTERNS.keys())
    for net in nets:
      found = sorted({
          clean_url_item(lnk)
          for lnk in re.findall(
              SOCIAL_PATTERNS[net], combined, flags=re.IGNORECASE
          )
      })
      if found:
        c_row[net] = ", ".join(found)
        has_c = True

  if has_c:
    c_row["Source Page"] = clean_url_item(url)
    rows.append(c_row)

  return rows
