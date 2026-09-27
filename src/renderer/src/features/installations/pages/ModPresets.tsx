import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { FiLoader } from "react-icons/fi"
import { PiCheckDuotone, PiPlusDuotone, PiTrashDuotone, PiXCircleDuotone } from "react-icons/pi"
import { v4 as uuidv4 } from "uuid"
import { CONFIG_ACTIONS, useConfigContext } from "@renderer/features/config/contexts/ConfigContext"
import { useNotificationsContext } from "@renderer/contexts/NotificationsContext"
import { useQueryMods } from "@renderer/features/mods/hooks/useQueryMods"
import { useQueryMod } from "@renderer/features/mods/hooks/useQueryMod"
import { FormButton, FormInputText } from "@renderer/components/ui/FormComponents"
import { ListGroup, ListItem, ListWrapper } from "@renderer/components/ui/List"
import PopupDialogPanel from "@renderer/components/ui/PopupDialogPanel"
import ScrollableContainer from "@renderer/components/ui/ScrollableContainer"
import { StickyMenuBreadcrumbs, StickyMenuGroup, StickyMenuGroupWrapper, StickyMenuWrapper, GoBackButton, GoToTopButton } from "@renderer/components/ui/StickyMenu"

export default function ModPresets(): JSX.Element {
  const { t } = useTranslation()
  const { id } = useParams()
  const { config, configDispatch } = useConfigContext()
  const { addNotification } = useNotificationsContext()
  const installation = config.installations.find((item) => item.id === (id ?? config.lastUsedInstallation))
  const presetPath = id && installation ? `/installations/mods/${installation.id}/presets` : "/presets"
  const presets = installation?.modPresets ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = presets.find((preset) => preset.id === selectedId)
  const [name, setName] = useState("")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<DownloadableModOnListType[]>([])
  const [visibleResults, setVisibleResults] = useState(50)
  const [installed, setInstalled] = useState<InstalledModType[]>([])
  const [loadingInstalled, setLoadingInstalled] = useState(true)
  const [releaseMod, setReleaseMod] = useState<DownloadableModType | null>(null)
  const [confirmApply, setConfirmApply] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [searching, setSearching] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const queryMods = useQueryMods()
  const queryMod = useQueryMod()

  useEffect(() => {
    setSelectedId(null)
  }, [installation?.id])

  useEffect(() => {
    if (!installation) return
    let active = true
    setLoadingInstalled(true)
    window.api.modsManager
      .getInstalledMods(`${installation.path}/Mods`)
      .then(({ mods, errors }) => {
        if (active) setInstalled([...mods, ...errors.map((error) => ({ name: error.zipname, modid: error.zipname, version: "", path: error.path }))])
      })
      .catch(() => {
        if (active) addNotification(t("features.mods.presets.error"), "error")
      })
      .finally(() => {
        if (active) setLoadingInstalled(false)
      })
    return (): void => {
      active = false
    }
  }, [installation?.path])

  useEffect(() => {
    setVisibleResults(50)
    if (!selected || search.trim().length < 2) {
      setResults([])
      return
    }
    let active = true
    const timer = setTimeout(async () => {
      setSearching(true)
      const found = await queryMods({ textFilter: search.trim() })
      if (active) {
        setResults(found)
        setSearching(false)
      }
    }, 400)
    return (): void => {
      active = false
      clearTimeout(timer)
    }
  }, [search, selectedId])

  function savePresets(next: ModPresetType[], activeModPresetId = installation?.activeModPresetId ?? null): void {
    if (!installation) return
    configDispatch({ type: CONFIG_ACTIONS.EDIT_INSTALLATION, payload: { id: installation.id, updates: { modPresets: next, activeModPresetId } } })
  }

  function updateSelected(updates: Partial<ModPresetType>): void {
    if (!selected || busy) return
    savePresets(
      presets.map((preset) => (preset.id === selected.id ? { ...preset, ...updates } : preset)),
      updates.mods && installation?.activeModPresetId === selected.id ? null : installation?.activeModPresetId
    )
  }

  async function createPreset(fromCurrent: boolean): Promise<void> {
    if (!installation || !name.trim() || busy) return
    setBusy(true)
    const presetId = uuidv4()
    try {
      const mods = fromCurrent ? await window.api.modsManager.snapshotPresetMods(installation.path, installation.id, presetId, installed) : []
      const preset: ModPresetType = { id: presetId, name: name.trim(), mods }
      savePresets([...presets, preset])
      setSelectedId(presetId)
      setName("")
      addNotification(t("features.mods.presets.created"), "success")
    } catch (error) {
      await window.api.modsManager.deleteModPreset(installation.id, presetId).catch(() => false)
      addNotification(`${t("features.mods.presets.error")}: ${error}`, "error")
    } finally {
      setBusy(false)
    }
  }

  async function addLocal(mod: InstalledModType): Promise<void> {
    if (!installation || !selected || busy) return
    setBusy(true)
    try {
      const entries = await window.api.modsManager.snapshotPresetMods(installation.path, installation.id, selected.id, [mod])
      updateSelected({ mods: [...selected.mods, ...entries] })
    } catch (error) {
      addNotification(`${t("features.mods.presets.error")}: ${error}`, "error")
    } finally {
      setBusy(false)
    }
  }

  function addCatalog(release: DownloadableModReleaseType): void {
    if (!selected || !releaseMod || busy) return
    if (!release.mainfile) {
      addNotification(t("features.mods.presets.error"), "error")
      return
    }
    const url = new URL(release.mainfile, "https://mods.vintagestory.at")
    if (url.protocol !== "https:" || url.hostname !== "mods.vintagestory.at") {
      addNotification(t("features.mods.presets.error"), "error")
      return
    }
    const entry: ModPresetEntryType = {
      id: uuidv4(),
      name: releaseMod.name,
      modid: release.modidstr,
      version: release.modversion,
      source: "catalog",
      url: url.toString()
    }
    updateSelected({ mods: [...selected.mods, entry] })
    setReleaseMod(null)
  }

  async function applyPreset(): Promise<void> {
    if (!installation || !selected || busy) return
    if (installation._playing || installation._backuping || installation._restoringBackup || installation._updatingMods || installation._applyingModPreset) {
      addNotification(t("features.mods.presets.inUse"), "error")
      return
    }
    setConfirmApply(false)
    setBusy(true)
    configDispatch({ type: CONFIG_ACTIONS.EDIT_INSTALLATION, payload: { id: installation.id, updates: { _applyingModPreset: true } } })
    window.api.utils.setPreventAppClose("add", `mod-preset-${installation.id}`, t("features.mods.presets.applying"))
    try {
      const result = await window.api.modsManager.applyModPreset(installation.path, installation.id, selected)
      if (!result.success) throw new Error(result.error)
      configDispatch({ type: CONFIG_ACTIONS.EDIT_INSTALLATION, payload: { id: installation.id, updates: { activeModPresetId: selected.id, _modsCount: selected.mods.length } } })
      addNotification(t("features.mods.presets.applied"), "success")
      const refreshed = await window.api.modsManager.getInstalledMods(`${installation.path}/Mods`)
      setInstalled([...refreshed.mods, ...refreshed.errors.map((error) => ({ name: error.zipname, modid: error.zipname, version: "", path: error.path }))])
    } catch (error) {
      addNotification(`${t("features.mods.presets.error")}: ${error}`, "error")
    } finally {
      window.api.utils.setPreventAppClose("remove", `mod-preset-${installation.id}`, "")
      configDispatch({ type: CONFIG_ACTIONS.EDIT_INSTALLATION, payload: { id: installation.id, updates: { _applyingModPreset: false } } })
      setBusy(false)
    }
  }

  async function deletePreset(): Promise<void> {
    if (!installation || !selected || busy) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      const deleted = await window.api.modsManager.deleteModPreset(installation.id, selected.id)
      if (!deleted) throw new Error("Could not delete preset cache")
      savePresets(
        presets.filter((preset) => preset.id !== selected.id),
        installation.activeModPresetId === selected.id ? null : installation.activeModPresetId
      )
      setSelectedId(null)
    } catch (error) {
      addNotification(`${t("features.mods.presets.error")}: ${error}`, "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollableContainer ref={scrollRef}>
      <div className="min-h-full flex flex-col items-center gap-2">
        <StickyMenuWrapper scrollRef={scrollRef}>
          <StickyMenuGroupWrapper>
            <StickyMenuGroup>
              <GoBackButton to={installation ? `/installations/mods/${installation.id}` : "/installations"} />
            </StickyMenuGroup>
            <StickyMenuBreadcrumbs
              breadcrumbs={[
                { name: t("breadcrumbs.installations"), to: "/installations" },
                { name: t("breadcrumbs.manageMods"), to: installation ? `/installations/mods/${installation.id}` : "/installations" },
                { name: t("features.mods.presets.title"), to: presetPath }
              ]}
            />
            <StickyMenuGroup>
              <GoToTopButton scrollRef={scrollRef} />
            </StickyMenuGroup>
          </StickyMenuGroupWrapper>
        </StickyMenuWrapper>

        {!installation ? (
          <p>{t("features.installations.noInstallationFound")}</p>
        ) : (
          <div className="max-w-[50rem] w-full flex flex-col gap-2 m-auto">
            <ListWrapper>
              <ListGroup>
                <div className="flex flex-wrap gap-2 items-center justify-center p-2">
                  <FormInputText value={name} onChange={(event) => setName(event.target.value)} placeholder={t("features.mods.presets.name")} maxLength={80} className="w-48" />
                  <FormButton title={t("features.mods.presets.createEmpty")} onClick={() => createPreset(false)} disabled={!name.trim() || busy} className="p-1 px-3 h-8">
                    <PiPlusDuotone />
                    {t("features.mods.presets.createEmpty")}
                  </FormButton>
                  <FormButton title={t("features.mods.presets.createCurrent")} onClick={() => createPreset(true)} disabled={!name.trim() || busy || loadingInstalled} className="p-1 px-3 h-8">
                    <PiPlusDuotone />
                    {t("features.mods.presets.createCurrent")}
                  </FormButton>
                </div>
                {presets.map((preset) => (
                  <ListItem key={preset.id} onClick={() => setSelectedId(preset.id)} className={selectedId === preset.id ? "border-vs" : ""}>
                    <div className="flex justify-between items-center gap-2 p-3">
                      <span className="font-bold">{preset.name}</span>
                      <span className="text-sm text-zinc-400">{t("features.mods.modsCount", { count: preset.mods.length })}</span>
                      {installation.activeModPresetId === preset.id && (
                        <span className="text-lime-600 flex items-center gap-1">
                          <PiCheckDuotone />
                          {t("features.mods.presets.active")}
                        </span>
                      )}
                    </div>
                  </ListItem>
                ))}
                {presets.length === 0 && <p className="text-center p-2 text-zinc-400">{t("features.mods.presets.none")}</p>}
              </ListGroup>
            </ListWrapper>

            {selected && (
              <>
                <ListWrapper>
                  <ListGroup>
                    <div className="flex flex-wrap gap-2 items-center justify-center p-2">
                      <FormInputText
                        value={selected.name}
                        onChange={(event) => updateSelected({ name: event.target.value })}
                        placeholder={t("features.mods.presets.name")}
                        maxLength={80}
                        className="w-48"
                        disabled={busy}
                      />
                      <FormButton title={t("features.mods.presets.apply")} onClick={() => setConfirmApply(true)} disabled={busy || !selected.name.trim()} className="p-1 px-3 h-8" type="success">
                        {busy ? <FiLoader className="animate-spin" /> : <PiCheckDuotone />}
                        {t("features.mods.presets.apply")}
                      </FormButton>
                      <FormButton title={t("generic.delete")} onClick={() => setConfirmDelete(true)} disabled={busy} className="p-1 px-3 h-8" type="error">
                        <PiTrashDuotone />
                        {t("generic.delete")}
                      </FormButton>
                    </div>
                    {selected.mods.map((mod) => (
                      <ListItem key={mod.id}>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="truncate">
                            {mod.name} {mod.version && `v${mod.version}`}
                          </span>
                          <span className="text-sm text-zinc-400">{t(`features.mods.presets.${mod.source}`)}</span>
                          <FormButton
                            title={t("generic.delete")}
                            onClick={() => updateSelected({ mods: selected.mods.filter((entry) => entry.id !== mod.id) })}
                            disabled={busy}
                            className="p-1"
                            type="error"
                          >
                            <PiTrashDuotone />
                          </FormButton>
                        </div>
                      </ListItem>
                    ))}
                    {selected.mods.length === 0 && <p className="text-center p-2 text-zinc-400">{t("features.mods.presets.empty")}</p>}
                  </ListGroup>
                </ListWrapper>

                <ListWrapper>
                  <ListGroup>
                    <h2 className="text-center font-bold p-2">{t("features.mods.presets.addInstalled")}</h2>
                    {loadingInstalled && <FiLoader className="animate-spin mx-auto" />}
                    {installed
                      .filter((mod) => !selected.mods.some((entry) => entry.modid === mod.modid))
                      .map((mod) => (
                        <ListItem key={mod.path}>
                          <div className="flex justify-between items-center gap-2 p-2">
                            <span className="truncate">
                              {mod.name} {mod.version && `v${mod.version}`}
                            </span>
                            <FormButton title={t("generic.add")} onClick={() => addLocal(mod)} disabled={busy} className="p-1">
                              <PiPlusDuotone />
                            </FormButton>
                          </div>
                        </ListItem>
                      ))}
                  </ListGroup>
                </ListWrapper>

                <ListWrapper>
                  <ListGroup>
                    <h2 className="text-center font-bold p-2">{t("features.mods.presets.addCatalog")}</h2>
                    <FormInputText value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("features.mods.presets.search")} className="w-full" />
                    {searching && <FiLoader className="animate-spin mx-auto" />}
                    {results
                      .filter((mod) => !selected.mods.some((entry) => mod.modidstrs.includes(entry.modid)))
                      .slice(0, visibleResults)
                      .map((mod) => (
                        <ListItem key={mod.modid}>
                          <div className="flex justify-between items-center gap-2 p-2">
                            <span className="truncate">{mod.name}</span>
                            <FormButton
                              title={t("generic.add")}
                              onClick={async () => {
                                const full = await queryMod({ modid: mod.modid })
                                if (full) setReleaseMod(full)
                                else addNotification(t("features.mods.presets.error"), "error")
                              }}
                              disabled={busy}
                              className="p-1"
                            >
                              <PiPlusDuotone />
                            </FormButton>
                          </div>
                        </ListItem>
                      ))}
                    {results.length > visibleResults && (
                      <FormButton title={t("features.mods.presets.more")} onClick={() => setVisibleResults((count) => count + 50)} className="p-2 mx-auto">
                        {t("features.mods.presets.more")}
                      </FormButton>
                    )}
                  </ListGroup>
                </ListWrapper>
              </>
            )}
          </div>
        )}
      </div>

      <PopupDialogPanel title={releaseMod?.name ?? ""} isOpen={releaseMod !== null} close={() => setReleaseMod(null)}>
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {releaseMod?.releases.length === 0 && <p>{t("features.mods.importModpackNoRelease")}</p>}
          {releaseMod?.releases.map((release) => (
            <FormButton key={release.releaseid} title={release.modversion} onClick={() => addCatalog(release)} className="p-2 justify-between">
              <span>v{release.modversion}</span>
              <span className="text-sm text-zinc-400">{release.tags.join(", ")}</span>
              <PiPlusDuotone />
            </FormButton>
          ))}
        </div>
      </PopupDialogPanel>
      <PopupDialogPanel title={t("features.mods.presets.apply")} isOpen={confirmApply} close={() => setConfirmApply(false)}>
        <>
          <p>{t("features.mods.presets.applyWarning")}</p>
          <div className="flex gap-2 justify-center">
            <FormButton title={t("generic.cancel")} onClick={() => setConfirmApply(false)} className="p-2">
              <PiXCircleDuotone />
            </FormButton>
            <FormButton title={t("features.mods.presets.apply")} onClick={applyPreset} className="p-2" type="success">
              <PiCheckDuotone />
            </FormButton>
          </div>
        </>
      </PopupDialogPanel>
      <PopupDialogPanel title={t("generic.delete")} isOpen={confirmDelete} close={() => setConfirmDelete(false)}>
        <>
          <p>{t("features.mods.presets.deleteWarning")}</p>
          <div className="flex gap-2 justify-center">
            <FormButton title={t("generic.cancel")} onClick={() => setConfirmDelete(false)} className="p-2">
              <PiXCircleDuotone />
            </FormButton>
            <FormButton title={t("generic.delete")} onClick={deletePreset} className="p-2" type="error">
              <PiTrashDuotone />
            </FormButton>
          </div>
        </>
      </PopupDialogPanel>
    </ScrollableContainer>
  )
}
