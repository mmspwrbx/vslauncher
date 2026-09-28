export function modDescriptionText(html: string): string {
  const document = new DOMParser().parseFromString(html.replace(/<\s*br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n\n"), "text/html")
  document.querySelectorAll("script, style").forEach((element) => element.remove())
  return document.body.textContent?.replace(/\n\s*\n\s*\n/g, "\n\n").trim() ?? ""
}
