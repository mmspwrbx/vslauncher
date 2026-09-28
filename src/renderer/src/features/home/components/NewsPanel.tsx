import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FiExternalLink, FiFileText, FiLoader } from "react-icons/fi"

import { FormButton } from "@renderer/components/ui/FormComponents"
import PopupDialogPanel from "@renderer/components/ui/PopupDialogPanel"
import { NEWS_FEED_URL, NEWS_PAGE_URL, NewsBlock, NewsItem, parseNewsFeed } from "../newsFeed"

function NewsContent({ block }: { block: NewsBlock }): JSX.Element {
  if (block.type === "heading") return <h3 className="text-lg font-semibold">{block.text}</h3>
  if (block.type === "paragraph") return <p className="whitespace-pre-wrap select-text">{block.text}</p>
  if (block.type === "image") return <img src={block.url} alt={block.alt} className="w-full max-h-[32rem] object-contain rounded-sm" loading="lazy" />

  const List = block.ordered ? "ol" : "ul"
  return (
    <List className={block.ordered ? "list-decimal pl-6 space-y-1" : "list-disc pl-6 space-y-1"}>
      {block.items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </List>
  )
}

export default function NewsPanel(): JSX.Element {
  const { t, i18n } = useTranslation()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<NewsItem | null>(null)

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      if (active) setLoading(false)
    }, 15_000)

    window.api.netManager
      .queryURL(NEWS_FEED_URL)
      .then((xml) => {
        if (active) setNews(parseNewsFeed(xml, 12))
      })
      .catch(() => {
        // The official site may be temporarily unavailable.
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (active) setLoading(false)
      })

    return (): void => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [])

  return (
    <>
      <section className="h-[34rem] min-w-0 min-h-0 overflow-hidden flex flex-col gap-3 p-4 rounded-md border border-zinc-400/10 bg-zinc-950/55 backdrop-blur-sm shadow-lg shadow-zinc-950/30 xl:absolute xl:inset-0 xl:h-auto">
        <h2 className="text-xl font-semibold">{t("features.home.latestNews")}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
          {loading && <FiLoader className="animate-spin text-2xl text-zinc-400 self-center my-auto" />}
          {!loading && news.length === 0 && (
            <div className="flex flex-col items-center gap-3 my-auto text-center">
              <p className="text-zinc-300">{t("features.home.newsUnavailable")}</p>
              <FormButton title={t("features.home.openNewsSite")} onClick={() => window.api.utils.openOnBrowser(NEWS_PAGE_URL)} className="px-3 py-2">
                <FiExternalLink />
                {t("features.home.openNewsSite")}
              </FormButton>
            </div>
          )}
          {news.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="w-full shrink-0 flex gap-3 p-2 text-left rounded-sm border border-zinc-400/10 bg-zinc-950/45 hover:bg-zinc-950/65 cursor-pointer duration-150"
            >
              <div className="shrink-0 w-28 h-24 flex items-center justify-center rounded-sm overflow-hidden bg-zinc-900 text-zinc-500">
                {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" /> : <FiFileText className="text-3xl" />}
              </div>
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-xs text-zinc-400">{new Date(item.published).toLocaleDateString(i18n.language)}</span>
                <span className="font-semibold line-clamp-2">{item.title}</span>
                <span className="text-sm text-zinc-300 line-clamp-3">{item.summary}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <PopupDialogPanel title={selected?.title ?? ""} isOpen={selected !== null} close={() => setSelected(null)} fixedWidth={false}>
        <div className="w-[min(60rem,calc(100vw-3rem))] max-h-[75vh] min-h-0 flex flex-col gap-4 text-left">
          <p className="text-sm text-zinc-400">{selected && new Date(selected.published).toLocaleDateString(i18n.language)}</p>
          <div className="min-h-0 overflow-y-auto flex flex-col gap-4 pr-2">
            {selected?.blocks.map((block, index) => (
              <NewsContent key={index} block={block} />
            ))}
          </div>
          <FormButton title={t("features.home.openFullArticle")} onClick={() => selected && window.api.utils.openOnBrowser(selected.url)} className="self-end shrink-0 px-3 py-2">
            <FiExternalLink />
            {t("features.home.openFullArticle")}
          </FormButton>
        </div>
      </PopupDialogPanel>
    </>
  )
}
