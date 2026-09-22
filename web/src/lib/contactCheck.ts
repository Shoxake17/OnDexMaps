/**
 * Kontaktlar (sayt, ijtimoiy tarmoq) uchun QULAY tekshiruv.
 *
 * ⚠️ Bu faqat foydalanuvchiga xatoni darrov ko'rsatish uchun. HAQIQIY
 * tekshiruv serverda (`internal/places/contacts.go`) va bazadagi CHECK'da:
 * mijoz kodini chetlab o'tish mumkin, serverni esa yo'q.
 * Qoidalar serverdagi bilan bir xil: faqat http/https, domen nomi (IP emas),
 * kirish ma'lumotisiz; ijtimoiy tarmoq — faqat ma'lum tarmoq va akkaunt yo'li.
 */

/** Xato matni yoki `null` (yaroqli yoki bo'sh). */
function checkWebUrl(raw: string, label: string): { url: URL | null; error: string | null } {
  const v = raw.trim();
  if (v === "") return { url: null, error: null };
  if (/\s/.test(v)) return { url: null, error: `«${label}» manzilida bo'sh joy bo'lmasin` };

  const lower = v.toLowerCase();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/.test(lower) && !/^[^/?#:]+:\d+([/?#]|$)/.test(lower);
  if (hasScheme && !/^https?:\/\//.test(lower)) {
    return { url: null, error: `«${label}» faqat http yoki https bo'lishi mumkin` };
  }
  let u: URL;
  try {
    u = new URL(hasScheme ? v : `https://${v}`);
  } catch {
    return { url: null, error: `«${label}» manzili noto'g'ri` };
  }
  if (u.username || u.password) {
    return { url: null, error: `«${label}» manzilida foydalanuvchi nomi/paroli bo'lmasin` };
  }
  const host = u.hostname.toLowerCase();
  // Domen: nuqta bilan ajratilgan ASCII bo'laklar, IP va ichki nomlar emas.
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  const internal = /(^localhost$)|(\.(local|localhost|internal|intranet|lan|home|corp|test|invalid)$)/.test(host);
  if (isIp || internal || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || !/[a-z]{2,}$/.test(host)) {
    return { url: null, error: `«${label}» manzilida to'g'ri domen nomi bo'lishi kerak` };
  }
  return { url: u, error: null };
}

export function siteProblem(raw: string, max: number): string | null {
  const r = checkWebUrl(raw, "Veb-sayt");
  if (r.error) return r.error;
  if (raw.trim().length > max) return "«Veb-sayt» manzili juda uzun";
  return null;
}

export function socialProblem(raw: string, hosts: string[], max: number): string | null {
  const r = checkWebUrl(raw, "Ijtimoiy tarmoq");
  if (r.error) return r.error;
  if (!r.url) return null;
  const h = r.url.hostname.toLowerCase();
  if (!hosts.some((d) => h === d || h.endsWith(`.${d}`))) {
    return "«Ijtimoiy tarmoq» manzili ma'lum tarmoqdan bo'lishi kerak (Instagram, Telegram, Facebook, YouTube, TikTok...)";
  }
  if (r.url.pathname.replace(/\//g, "") === "") {
    return "«Ijtimoiy tarmoq» manzilida akkaunt yo'li bo'lsin (masalan: instagram.com/nomi)";
  }
  if (raw.trim().length > max) return "«Ijtimoiy tarmoq» manzili juda uzun";
  return null;
}

/** Havola sifatida ko'rsatish uchun xavfsiz `href`: faqat http/https, aks holda `null`. */
export function safeHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Ijtimoiy tarmoq nomi (ko'rsatish uchun): `instagram.com/x` → «Instagram». */
export function socialName(url: string): string {
  let h = "";
  try {
    h = new URL(url).hostname.toLowerCase();
  } catch {
    return "Ijtimoiy tarmoq";
  }
  const is = (d: string) => h === d || h.endsWith(`.${d}`);
  if (is("instagram.com")) return "Instagram";
  if (is("t.me") || is("telegram.me")) return "Telegram";
  if (is("facebook.com") || is("fb.com")) return "Facebook";
  if (is("youtube.com") || is("youtu.be")) return "YouTube";
  if (is("tiktok.com")) return "TikTok";
  if (is("x.com") || is("twitter.com")) return "X";
  if (is("linkedin.com")) return "LinkedIn";
  if (is("vk.com")) return "VK";
  if (is("ok.ru")) return "OK";
  if (is("threads.net")) return "Threads";
  if (is("wa.me")) return "WhatsApp";
  return "Ijtimoiy tarmoq";
}

/** Havola matni: sxema va oxirgi «/» siz («instagram.com/nomi»). */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
