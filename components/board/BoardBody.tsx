import { boardTextParts } from "@/lib/board/text";

export function BoardBody({ children, className = "" }: { children: string; className?: string }) {
  return <p className={`board-body ${className}`}>{boardTextParts(children).map((part, index) => part.href
    ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 wrap-anywhere">{part.text}</a>
    : part.text)}</p>;
}
