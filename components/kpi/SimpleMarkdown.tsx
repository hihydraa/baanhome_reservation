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
  let table: string[][] = [];
  const flushTable = (key: number) => {
    if (!table.length) return;
    const [head, ...rows] = table;
    blocks.push(
      <div key={`tb-${key}`} className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} className="border border-cream-200 bg-cream-100 px-2 py-1 text-left font-semibold">{inline(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, i) => (
                  <td key={i} className="border border-cream-200 px-2 py-1">{inline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    table = [];
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.trimStart().startsWith("|")) {
      flush(i);
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) table.push(cells);
      return;
    }
    flushTable(i);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flush(i);
    if (!line.trim()) return;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h && h[1].length >= 3) blocks.push(<h4 key={i} className="mt-2 text-sm font-semibold text-ink-800">{inline(h[2])}</h4>);
    else if (h) blocks.push(<h3 key={i} className="mt-3 text-sm font-semibold text-forest-800 first:mt-0">{inline(h[2])}</h3>);
    else blocks.push(<p key={i}>{inline(line)}</p>);
  });
  flush(text.length);
  flushTable(text.length);
  return <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-800">{blocks}</div>;
}
