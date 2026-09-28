import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { FiExternalLink } from "react-icons/fi"

import { FormButton } from "@renderer/components/ui/FormComponents"
import NewsPanel from "../components/NewsPanel"

const CHANNEL_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UC_5Yt95xDaMtAJf9kXileAQ"
const FALLBACK_VIDEO = { id: "mgvzBB_--xM", title: "1.22.0 - Fishing, Mechanisms, Metalworking and More!" }
const RELEASE_TITLE = /^v?\d+\.\d+(?:\.\d+)?\s*[-–—:]/i
const PRE_RELEASE_TITLE = /\b(?:wip|preview|pre-release|release candidate|rc\d*|teaser)\b/i

function latestReleaseVideo(feed: string): typeof FALLBACK_VIDEO | null {
  const xml = new DOMParser().parseFromString(feed, "application/xml")
  if (xml.querySelector("parsererror")) return null

  for (const entry of Array.from(xml.getElementsByTagName("entry"))) {
    const title = entry.getElementsByTagName("title")[0]?.textContent?.trim()
    const id = entry.getElementsByTagName("yt:videoId")[0]?.textContent?.trim()
    if (title && id && RELEASE_TITLE.test(title) && !PRE_RELEASE_TITLE.test(title) && /^[\w-]{11}$/.test(id)) return { id, title }
  }

  return null
}

function HomePage(): JSX.Element {
  const { t } = useTranslation()
  const [video, setVideo] = useState(FALLBACK_VIDEO)

  useEffect(() => {
    let active = true
    window.api.netManager
      .queryURL(CHANNEL_FEED)
      .then((feed) => {
        const latest = latestReleaseVideo(feed)
        if (active && latest) setVideo(latest)
      })
      .catch(() => {
        // Keep the last known release video when the channel feed is unavailable.
      })

    return (): void => {
      active = false
    }
  }, [])

  return (
    <div className="w-full h-full overflow-y-auto p-4">
      <div className="max-w-[88rem] min-h-full mx-auto py-6 flex flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold text-center drop-shadow-md">{t("features.home.title")}</h1>
        <div className="w-full grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,1fr)] gap-4">
          <section className="min-w-0 flex flex-col gap-4 p-4 rounded-md border border-zinc-400/10 bg-zinc-950/55 backdrop-blur-sm shadow-lg shadow-zinc-950/30">
            <div>
              <p className="text-sm text-zinc-300">{t("features.home.latestReleaseVideo")}</p>
              <h2 className="text-xl font-semibold">{video.title}</h2>
            </div>
            <div className="w-full aspect-video overflow-hidden rounded-sm bg-zinc-950/70">
              <iframe
                key={video.id}
                src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                title={video.title}
                className="w-full h-full border-0"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <FormButton title={t("features.home.openOnYouTube")} onClick={() => window.api.utils.openOnBrowser(`https://www.youtube.com/watch?v=${video.id}`)} className="self-end px-3 py-2">
              <FiExternalLink />
              {t("features.home.openOnYouTube")}
            </FormButton>
          </section>
          <div className="min-w-0 xl:relative">
            <NewsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
