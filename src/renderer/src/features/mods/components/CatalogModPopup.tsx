import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { FiLoader } from "react-icons/fi"
import { PiArrowLeftDuotone, PiDownloadDuotone, PiPlusDuotone } from "react-icons/pi"
import { v4 as uuidv4 } from "uuid"

import { useNotificationsContext } from "@renderer/contexts/NotificationsContext"
import { FormButton, FormLinkButton } from "@renderer/components/ui/FormComponents"
import PopupDialogPanel from "@renderer/components/ui/PopupDialogPanel"
import { CONFIG_ACTIONS, useConfigContext } from "@renderer/features/config/contexts/ConfigContext"
import { useQueryMod } from "@renderer/features/mods/hooks/useQueryMod"
import { modDescriptionText } from "@renderer/features/mods/utils/modDescription"

type PopupMode = "details" | "preset"

function modDbUrl(path: string): string | null {
  try {
    const url = new URL(path, "https://mods.vintagestory.at")
    return url.protocol === "https:" && (url.hostname === "mods.vintagestory.at" || url.hostname === "moddbcdn.vintagestory.at") ? url.toString() : null
  } catch {
    return null
  }
}

export default function CatalogModPopup({
  mod,
  mode,
  installation,
  close,
  showDetails,
  showPreset,
  download
}: {
  mod: DownloadableModOnListType | null
  mode: PopupMode
  installation?: InstallationType
  close: () => void
  showDetails: () => void
  showPreset: () => void
  download: () => void
}): JSX.Element {
  const { t } = useTranslation()
  const { configDispatch } = useConfigContext()
  const { addNotification } = useNotificationsContext()
  const queryMod = useQueryMod()
  const [fullMod, setFullMod] = useState<DownloadableModType | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [mode, mod?.modid])

  useEffect(() => {
    if (!mod) {
      setFullMod(null)
      return
    }
    let active = true
    setFullMod(null)
    setLoading(true)
    setSelectedScreenshot(0)
    queryMod({ modid: mod.modid }).then((result) => {
      if (active) {
        setFullMod(result ?? null)
        setLoading(false)
      }
    })
    return (): void => {
      active = false
    }
  }, [mod?.modid])

  const presets = installation?.modPresets ?? []
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0]

  function addToPreset(release: DownloadableModReleaseType): void {
    if (!installation || !selectedPreset || !fullMod) return
    const url = modDbUrl(release.mainfile)
    if (!url) {
      addNotification(t("features.mods.presets.error"), "error")
      return
    }
    if (selectedPreset.mods.some((entry) => entry.modid === release.modidstr)) return

    const entry: ModPresetEntryType = {
      id: uuidv4(),
      name: fullMod.name,
      modid: release.modidstr,
      version: release.modversion,
      source: "catalog",
      url,
      description: modDescriptionText(fullMod.text),
      logo: fullMod.logofile ?? undefined
    }
    configDispatch({
      type: CONFIG_ACTIONS.EDIT_INSTALLATION,
      payload: {
        id: installation.id,
        updates: {
          modPresets: presets.map((preset) => (preset.id === selectedPreset.id ? { ...preset, mods: [...preset.mods, entry] } : preset)),
          activeModPresetId: installation.activeModPresetId === selectedPreset.id ? null : installation.activeModPresetId
        }
      }
    })
    addNotification(t("features.mods.addedToPreset", { preset: selectedPreset.name }), "success")
    close()
  }

  const screenshots =
    fullMod?.screenshots
      .map((screenshot) => ({
        image: modDbUrl(screenshot.mainfile),
        thumbnail: (screenshot.thumbnailfilename && modDbUrl(screenshot.thumbnailfilename)) || modDbUrl(screenshot.mainfile)
      }))
      .filter((screenshot): screenshot is { image: string; thumbnail: string } => screenshot.image !== null && screenshot.thumbnail !== null) ?? []

  return (
    <PopupDialogPanel title={mod?.name ?? ""} isOpen={mod !== null} close={close} fixedWidth={false}>
      <div className="w-[min(50rem,calc(100vw-3rem))] max-h-[75vh] text-left flex flex-col gap-3">
        <div ref={scrollRef} className="min-h-0 overflow-y-auto flex flex-col gap-4 pr-2">
          {loading ? (
            <FiLoader className="animate-spin text-3xl text-zinc-400 self-center" />
          ) : !fullMod ? (
            <p className="text-center text-zinc-400">{t("features.mods.detailsLoadError")}</p>
          ) : mode === "details" ? (
            <>
              <p className="text-sm text-zinc-400">{fullMod.author}</p>
              {screenshots.length > 0 && (
                <div className="flex flex-col gap-2">
                  <img
                    src={screenshots[selectedScreenshot]?.image ?? screenshots[0].image}
                    alt={`${fullMod.name} ${selectedScreenshot + 1}`}
                    className="w-full max-h-72 rounded-sm object-contain bg-zinc-950/50"
                  />
                  {screenshots.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {screenshots.map((screenshot, index) => (
                        <button
                          key={screenshot.image}
                          type="button"
                          onClick={() => setSelectedScreenshot(index)}
                          title={`${fullMod.name} ${index + 1}`}
                          aria-label={`${fullMod.name} ${index + 1}`}
                          className={`shrink-0 w-20 h-14 rounded-sm overflow-hidden border cursor-pointer ${index === selectedScreenshot ? "border-lime-600" : "border-zinc-400/20"}`}
                        >
                          <img src={screenshot.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap select-text">{modDescriptionText(fullMod.text) || mod?.summary || t("features.mods.noDescription")}</p>
            </>
          ) : presets.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <p>{t("features.mods.presets.none")}</p>
              <FormLinkButton to="/presets" title={t("features.mods.presets.title")} className="p-2">
                {t("features.mods.presets.title")}
              </FormLinkButton>
            </div>
          ) : (
            <>
              <p>{t("features.mods.choosePreset")}</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <FormButton key={preset.id} title={preset.name} onClick={() => setSelectedPresetId(preset.id)} type={preset.id === selectedPreset?.id ? "success" : "normal"} className="px-3 py-1">
                    {preset.name}
                  </FormButton>
                ))}
              </div>
              <p>{t("features.mods.installationPopupDesc", { modName: fullMod.name })}</p>
              {fullMod.releases.length === 0 && <p>{t("features.mods.importModpackNoRelease")}</p>}
              <div className="shrink-0 flex flex-col gap-2">
                {fullMod.releases.map((release) => {
                  const alreadyAdded = selectedPreset?.mods.some((entry) => entry.modid === release.modidstr)
                  return (
                    <FormButton
                      key={release.releaseid}
                      title={alreadyAdded ? t("features.mods.alreadyInPreset") : t("features.mods.addToPreset")}
                      onClick={() => addToPreset(release)}
                      disabled={alreadyAdded || !modDbUrl(release.mainfile)}
                      className="w-full min-h-12 shrink-0 px-3 py-2 justify-between"
                    >
                      <span className="shrink-0 w-24 text-left font-medium">v{release.modversion}</span>
                      <span className="min-w-0 grow truncate text-left text-sm text-zinc-400" title={release.tags.join(", ")}>
                        {release.tags.join(", ")}
                      </span>
                      <PiPlusDuotone className="shrink-0 text-lg" />
                    </FormButton>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {!loading && fullMod && (
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-zinc-400/20">
            {mode === "preset" && (
              <FormButton title={t("generic.goBack")} onClick={showDetails} className="px-3 py-2">
                <PiArrowLeftDuotone />
                {t("generic.goBack")}
              </FormButton>
            )}
            <FormButton title={t("features.mods.downloadMod")} onClick={download} className="px-3 py-2" type="success">
              <PiDownloadDuotone />
              {t("features.mods.downloadMod")}
            </FormButton>
            {mode === "details" && (
              <FormButton title={t("features.mods.addToPreset")} onClick={showPreset} className="px-3 py-2">
                <PiPlusDuotone />
                {t("features.mods.addToPreset")}
              </FormButton>
            )}
          </div>
        )}
      </div>
    </PopupDialogPanel>
  )
}
