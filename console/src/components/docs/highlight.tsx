/**
 * Kod bo'yash — tashqi kutubxonasiz.
 *
 * Nega o'zimizniki: hujjatlarda atigi to'rt til bor (HTML, JS/TS, JSON, shell),
 * to'liq highlighter esa bir necha yuz kilobayt va yangi ta'minot zanjiri
 * bog'liqligi. Bu yerda bitta regex bilan token turlari ajratiladi va HAR BIR
 * bo'lak React elementi sifatida chiqadi — `dangerouslySetInnerHTML` ishlatilmaydi,
 * ya'ni kod matni hech qachon HTML sifatida talqin qilinmaydi.
 */

const KEYWORDS =
  "const|let|var|function|return|new|import|export|from|as|async|await|if|else|for|while|try|catch|class|extends|type|interface|default|typeof|null|undefined|true|false";

const CLASS = {
  comment: "text-slate-500 italic",
  string: "text-emerald-300",
  keyword: "text-violet-300",
  number: "text-amber-300",
  tag: "text-sky-300",
  attr: "text-sky-200",
} as const;

type Kind = keyof typeof CLASS;

/** `#` bilan boshlanadigan izoh faqat shell/terminal uchun — CSS'dagi `#map` selektoriga tegmaslik uchun. */
function pattern(shellComments: boolean): RegExp {
  const comment = shellComments
    ? String.raw`\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*|#[^\n]*`
    : String.raw`\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*`;

  return new RegExp(
    [
      `(${comment})`,
      String.raw`("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\`(?:[^\`\\]|\\.)*\`)`,
      String.raw`(<\/?[A-Za-z][\w:.-]*)`,
      String.raw`\b(${KEYWORDS})\b`,
      String.raw`\b(\d+(?:\.\d+)*)\b`,
      String.raw`([A-Za-z-]+)(?==")`,
    ].join("|"),
    "g",
  );
}

const SHELL_LANGS = new Set(["bash", "sh", "shell", "terminal", "csp", "http"]);

export function highlight(code: string, lang?: string): React.ReactNode {
  const re = pattern(SHELL_LANGS.has((lang ?? "").toLowerCase()));
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (let m = re.exec(code); m !== null; m = re.exec(code)) {
    if (m.index > last) out.push(code.slice(last, m.index));

    const kind: Kind | null = m[1]
      ? "comment"
      : m[2]
        ? "string"
        : m[3]
          ? "tag"
          : m[4]
            ? "keyword"
            : m[5]
              ? "number"
              : m[6]
                ? "attr"
                : null;

    if (kind) {
      out.push(
        <span key={key++} className={CLASS[kind]}>
          {m[0]}
        </span>,
      );
    } else {
      out.push(m[0]);
    }
    last = m.index + m[0].length;
  }

  if (last < code.length) out.push(code.slice(last));
  return out;
}
