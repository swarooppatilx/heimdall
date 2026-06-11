export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is safe static content
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
