export function OutputContent({ content }: { content: string }) {
  return /^https?:\/\/\S+$/i.test(content) ? (
    <a href={content} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <p className="outcome-output-content">{content}</p>
  );
}
