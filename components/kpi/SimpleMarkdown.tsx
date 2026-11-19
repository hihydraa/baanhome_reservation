import { Fragment } from "react";

/** Just enough markdown for the AI summary: ## headings, "-" lists, **bold** and paragraphs. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  );
}

export function SimpleMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: number) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc space-y-1 pl-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flush(i);
    if (!line.trim()) return;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) blocks.push(<h3 key={i} className="mt-3 text-sm font-semibold text-forest-800 first:mt-0">{inline(h[1])}</h3>);
    else blocks.push(<p key={i}>{inline(line)}</p>);
  });
  flush(text.length);
  return <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-800">{blocks}</div>;
}
