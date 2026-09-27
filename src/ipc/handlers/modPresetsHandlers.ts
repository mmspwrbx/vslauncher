import { app, ipcMain } from "electron"
import axios from "axios"
import fse from "fs-extra"
import { dirname, join, resolve } from "path"
import { pipeline } from "stream/promises"
import { v4 as uuidv4 } from "uuid"
import { IPC_CHANNELS } from "../ipcChannels"
import { logMessage } from "@src/utils/logManager"

const validId = (id: string): boolean => /^[a-f0-9-]{36}$/i.test(id)
const cachePath = (installationId: string, presetId: string): string => join(app.getPath("userData"), "ModPresets", installationId, presetId)
const busyInstallations = new Set<string>()

async function hasZipHeader(path: string): Promise<boolean> {
  const handle = await fse.open(path, "r")
  try {
    const header = Buffer.alloc(4)
    const { bytesRead } = await fse.read(handle, header, 0, 4, 0)
    return bytesRead === 4 && header[0] === 0x50 && header[1] === 0x4b
  } finally {
    await fse.close(handle)
  }
}

ipcMain.handle(IPC_CHANNELS.MODS_MANAGER.SNAPSHOT_PRESET_MODS, async (_event, path: string, installationId: string, presetId: string, mods: InstalledModType[]): Promise<ModPresetEntryType[]> => {
  if (!validId(installationId) || !validId(presetId) || !Array.isArray(mods)) throw new Error("Invalid preset")
  const modsPath = resolve(path, "Mods")
  const destination = cachePath(installationId, presetId)
  const entries: ModPresetEntryType[] = []
  await fse.ensureDir(destination)

  for (const mod of mods) {
    const source = resolve(mod.path)
    if (dirname(source) !== modsPath || !source.toLowerCase().endsWith(".zip")) throw new Error("Invalid mod path")
    const fileName = `${uuidv4()}.zip`
    await fse.copyFile(source, join(destination, fileName))
    entries.push({ id: uuidv4(), name: mod.name, modid: mod.modid, version: mod.version, source: "local", fileName })
  }
  return entries
})

ipcMain.handle(IPC_CHANNELS.MODS_MANAGER.APPLY_MOD_PRESET, async (_event, path: string, installationId: string, preset: ModPresetType): Promise<{ success: boolean; error?: string }> => {
  if (!validId(installationId) || !preset || !validId(preset.id) || !Array.isArray(preset.mods)) return { success: false, error: "Invalid preset" }
  const modsPath = resolve(path, "Mods")
  if (busyInstallations.has(modsPath)) return { success: false, error: "Preset operation already in progress" }
  busyInstallations.add(modsPath)
  const stage = `${modsPath}.preset-${uuidv4()}`
  const backup = `${modsPath}.previous-${uuidv4()}`
  let movedOld = false

  try {
    await fse.ensureDir(stage)
    const names = new Set<string>()
    for (const entry of preset.mods) {
      if (!entry || !validId(entry.id)) throw new Error("Invalid mod entry")
      let fileName: string
      if (entry.source === "local") {
        if (!entry.fileName || !/^[a-f0-9-]{36}\.zip$/i.test(entry.fileName)) throw new Error("Invalid local mod")
        fileName = entry.fileName
        const source = join(cachePath(installationId, preset.id), fileName)
        if (!(await fse.pathExists(source))) throw new Error(`Missing local mod: ${entry.name}`)
        await fse.copyFile(source, join(stage, fileName))
      } else if (entry.source === "catalog") {
        if (!entry.url) throw new Error(`Missing download URL: ${entry.name}`)
        const url = new URL(entry.url)
        if (url.protocol !== "https:" || url.hostname !== "mods.vintagestory.at") throw new Error("Invalid mod download URL")
        fileName = `${entry.id}.zip`
        const cached = join(cachePath(installationId, preset.id), fileName)
        if ((await fse.pathExists(cached)) && (await hasZipHeader(cached))) {
          await fse.copyFile(cached, join(stage, fileName))
        } else {
          const response = await axios.get(url.toString(), { responseType: "stream", timeout: 120000 })
          await pipeline(response.data, fse.createWriteStream(join(stage, fileName)))
        }
      } else {
        throw new Error("Invalid mod source")
      }
      if (names.has(fileName)) throw new Error("Duplicate mod archive")
      names.add(fileName)
      if (!(await hasZipHeader(join(stage, fileName)))) throw new Error(`Invalid mod archive: ${entry.name}`)
      if (entry.source === "catalog") {
        const cached = join(cachePath(installationId, preset.id), fileName)
        if (!(await fse.pathExists(cached)) || !(await hasZipHeader(cached))) {
          await fse.ensureDir(dirname(cached))
          await fse.copyFile(join(stage, fileName), cached)
        }
      }
    }

    if (await fse.pathExists(modsPath)) {
      await fse.move(modsPath, backup)
      movedOld = true
    }
    try {
      await fse.move(stage, modsPath)
    } catch (error) {
      if (movedOld) await fse.move(backup, modsPath)
      movedOld = false
      throw error
    }
    if (movedOld)
      await fse.remove(backup).catch((error) => {
        logMessage("warn", `[back] [mods] Preset applied, but could not remove previous Mods folder at ${backup}: ${error}`)
      })
    return { success: true }
  } catch (error) {
    logMessage("error", `[back] [mods] Failed to apply preset ${preset.id}: ${error}`)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    await fse.remove(stage).catch(() => {})
    busyInstallations.delete(modsPath)
  }
})

ipcMain.handle(IPC_CHANNELS.MODS_MANAGER.DELETE_MOD_PRESET, async (_event, installationId: string, presetId: string): Promise<boolean> => {
  if (!validId(installationId) || !validId(presetId)) return false
  try {
    await fse.remove(cachePath(installationId, presetId))
    return true
  } catch (error) {
    logMessage("error", `[back] [mods] Failed to delete preset cache ${presetId}: ${error}`)
    return false
  }
})
