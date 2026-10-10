/**
 * Markdown restreint des documents légaux (rédigés dans /admin). Aucune balise HTML n'est
 * interprétée : le texte est découpé en blocs typés, puis rendu en éléments React. Une balise
 * <script> écrite dans un document s'affiche donc comme du texte, jamais comme du code.
 *
 * Syntaxe : « ## Titre », « ### Sous-titre », paragraphes séparés par une ligne vide,
 * listes « - » et « 1. », encart « > », **gras**, [lien](/page | https://… | mailto: | tel:),
 * variables {{email}}, {{telephone}}, {{adresse_retrait}}.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; id: string; text: string }
  | { type: "p"; inlines: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] }
  | { type: "quote"; inlines: Inline[] };

export type LegalVariables = Record<string, string>;

const SAFE_HREF = /^(\/(?!\/)|https:\/\/|mailto:|tel:)/;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href.trim()) && !/[\s<>"]/.test(href.trim());
}

export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "section"
  );
}

/** Remplace {{variable}} ; une variable inconnue ou vide est retirée (jamais de champ vide affiché). */
export function fillVariables(source: string, variables: LegalVariables): string {
  return source.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, name: string) => variables[name] ?? "");
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/;
  while (rest.length > 0) {
    const match = pattern.exec(rest);
    if (!match) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (match.index > 0) out.push({ type: "text", text: rest.slice(0, match.index) });
    if (match[1] !== undefined) {
      out.push({ type: "strong", children: parseInline(match[1]) });
    } else {
      const label = match[2]!;
      const href = match[3]!;
      out.push(isSafeHref(href) ? { type: "link", href: href.trim(), children: parseInline(label) } : { type: "text", text: label });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

export function parseLegalMarkdown(source: string, variables: LegalVariables = {}): Block[] {
  const lines = fillVariables(source.replace(/\r\n?/g, "\n"), variables).split("\n");
  const blocks: Block[] = [];
  const ids = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = slugify(text);
    const n = ids.get(base) ?? 0;
    ids.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", inlines: parseInline(paragraph.join(" ")) });
    if (list) blocks.push({ type: list.type, items: list.items.map(parseInline) });
    if (quote.length) blocks.push({ type: "quote", inlines: parseInline(quote.join(" ")) });
    paragraph = [];
    list = null;
    quote = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    let match: RegExpExecArray | null;
    if ((match = /^(#{2,3})\s+(.+)$/.exec(line))) {
      flush();
      const text = match[2]!.trim();
      blocks.push({ type: match[1] === "##" ? "h2" : "h3", id: uniqueId(text), text });
    } else if ((match = /^[-*]\s+(.+)$/.exec(line))) {
      if (paragraph.length || quote.length || list?.type === "ol") flush();
      list ??= { type: "ul", items: [] };
      list.items.push(match[1]!);
    } else if ((match = /^\d+[.)]\s+(.+)$/.exec(line))) {
      if (paragraph.length || quote.length || list?.type === "ul") flush();
      list ??= { type: "ol", items: [] };
      list.items.push(match[1]!);
    } else if ((match = /^>\s?(.*)$/.exec(line))) {
      if (paragraph.length || list) flush();
      quote.push(match[1]!);
    } else if (list) {
      // Suite d'un élément de liste sur la ligne suivante.
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      if (quote.length) flush();
      paragraph.push(line.replace(/^#+\s*/, ""));
    }
  }
  flush();
  return blocks;
}

export function tableOfContents(blocks: Block[]): { id: string; text: string }[] {
  return blocks.flatMap((b) => (b.type === "h2" ? [{ id: b.id, text: b.text }] : []));
}
