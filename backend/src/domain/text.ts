export function safeSpreadsheet(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvLine(cells: unknown[]): string {
  return cells
    .map((cell) => {
      const safe = safeSpreadsheet(cell);
      const text = String(safe);
      return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(";");
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char] ?? char;
  });
}
