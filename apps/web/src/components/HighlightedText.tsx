interface HighlightedTextProps {
  text: string;
  keywords: string[];
}

export function HighlightedText({ text, keywords }: HighlightedTextProps) {
  if (!keywords || keywords.length === 0) {
    return <span>{text}</span>;
  }

  // Sort keywords by length (longest first) to match greedily
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");

  const parts = text.split(pattern);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = keywords.some((k) => k === part);
        return isMatch ? (
          <mark key={i} className="bg-yellow-600/40 text-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}
