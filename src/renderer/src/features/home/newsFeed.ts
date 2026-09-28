export const NEWS_FEED_URL = "https://www.vintagestory.at/blog.html/?rss=1"
export const NEWS_PAGE_URL = "https://www.vintagestory.at/blog.html/"

export type NewsBlock = { type: "heading"; text: string } | { type: "paragraph"; text: string } | { type: "list"; items: string[]; ordered: boolean } | { type: "image"; url: string; alt: string }

export type NewsItem = {
  id: string
  title: string
  url: string
  published: string
  summary: string
  image: string | null
  blocks: NewsBlock[]
}

function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim()
}

function officialImageUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, NEWS_PAGE_URL)
    if (url.protocol === "https:" && ["www.vintagestory.at", "media.vintagestory.at"].includes(url.hostname)) return url.toString()
  } catch {
    // Ignore invalid image URLs in the feed.
  }
  return null
}

function imageBlock(image: Element): NewsBlock | null {
  const url = officialImageUrl(image.getAttribute("src"))
  return url ? { type: "image", url, alt: image.getAttribute("alt") ?? "" } : null
}

function contentBlocks(html: string): NewsBlock[] {
  const document = new DOMParser().parseFromString(html, "text/html")
  document.querySelectorAll("script, style, iframe, form").forEach((element) => element.remove())
  const blocks: NewsBlock[] = []

  function add(element: Element): void {
    const tag = element.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      const text = textOf(element)
      if (text) blocks.push({ type: "heading", text })
    } else if (tag === "p" || tag === "blockquote") {
      const text = textOf(element)
      if (text) blocks.push({ type: "paragraph", text })
      element.querySelectorAll("img").forEach((image) => {
        const block = imageBlock(image)
        if (block) blocks.push(block)
      })
    } else if (tag === "ul" || tag === "ol") {
      const items = Array.from(element.children)
        .filter((item) => item.tagName.toLowerCase() === "li")
        .map(textOf)
        .filter(Boolean)
      if (items.length) blocks.push({ type: "list", items, ordered: tag === "ol" })
    } else if (tag === "img") {
      const block = imageBlock(element)
      if (block) blocks.push(block)
    } else {
      Array.from(element.children).forEach(add)
    }
  }

  Array.from(document.body.children).forEach(add)
  return blocks
}

export function parseNewsFeed(xml: string, limit = 3): NewsItem[] {
  const document = new DOMParser().parseFromString(xml, "application/xml")
  if (document.querySelector("parsererror")) return []

  return Array.from(document.getElementsByTagName("item"))
    .slice(0, limit)
    .flatMap((item): NewsItem[] => {
      const title = item.getElementsByTagName("title")[0]?.textContent?.trim()
      const link = item.getElementsByTagName("link")[0]?.textContent?.trim()
      const published = item.getElementsByTagName("pubDate")[0]?.textContent?.trim() ?? ""
      const html = item.getElementsByTagName("description")[0]?.textContent ?? ""
      if (!title || !link) return []

      let url: URL
      try {
        url = new URL(link)
      } catch {
        return []
      }
      if (url.protocol !== "https:" || url.hostname !== "www.vintagestory.at" || !url.pathname.startsWith("/blog.html/")) return []

      const blocks = contentBlocks(html)
      const summary = blocks
        .filter((block): block is Extract<NewsBlock, { type: "paragraph" }> => block.type === "paragraph")
        .slice(0, 2)
        .map((block) => block.text)
        .join(" ")
      const image = blocks.find((block): block is Extract<NewsBlock, { type: "image" }> => block.type === "image")?.url ?? null

      return [{ id: url.toString(), title, url: url.toString(), published, summary, image, blocks }]
    })
}
