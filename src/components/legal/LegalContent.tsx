import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, Inline } from "@/lib/legal/markdown";

const linkClass = "font-bold underline decoration-caramel decoration-2 underline-offset-4";

function renderInlines(inlines: Inline[]): ReactNode[] {
  return inlines.map((inline, index) => {
    if (inline.type === "text") return inline.text;
    if (inline.type === "strong") return <strong key={index}>{renderInlines(inline.children)}</strong>;
    return inline.href.startsWith("/") ? (
      <Link key={index} href={inline.href} className={linkClass}>
        {renderInlines(inline.children)}
      </Link>
    ) : (
      <a key={index} href={inline.href} className={linkClass}>
        {renderInlines(inline.children)}
      </a>
    );
  });
}

/** Rendu des blocs d'un document légal : uniquement des éléments React, aucun HTML brut. */
export function LegalContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="ohm-legal flex flex-col gap-4 text-[1.0625rem] leading-relaxed">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={index} id={block.id} className="mt-8 scroll-mt-28 font-display text-[clamp(1.45rem,3.4vw,1.8rem)] leading-tight first:mt-0 print:break-after-avoid">
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={index} id={block.id} className="mt-4 scroll-mt-28 text-[1.2rem] font-bold">
                {block.text}
              </h3>
            );
          case "p":
            return <p key={index}>{renderInlines(block.inlines)}</p>;
          case "ul":
            return (
              <ul key={index} className="flex list-disc flex-col gap-1.5 pl-6 marker:text-caramel-encre">
                {block.items.map((item, i) => (
                  <li key={i}>{renderInlines(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index} className="flex list-decimal flex-col gap-1.5 pl-6 marker:font-bold marker:text-caramel-encre">
                {block.items.map((item, i) => (
                  <li key={i}>{renderInlines(item)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <aside key={index} className="rounded-[14px] border-2 border-chocolat bg-blanc-casse p-4 font-bold shadow-[0_4px_0_var(--ohm-chocolat)] print:shadow-none">
                {renderInlines(block.inlines)}
              </aside>
            );
        }
      })}
    </div>
  );
}
