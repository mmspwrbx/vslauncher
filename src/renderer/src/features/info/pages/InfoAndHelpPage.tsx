import { useEffect, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { PiCoinsDuotone, PiInfoDuotone, PiUsersThreeDuotone, PiGithubLogoDuotone } from "react-icons/pi"

import ScrollableContainer from "@renderer/components/ui/ScrollableContainer"
import { FormButton } from "@renderer/components/ui/FormComponents"
import { NormalButton } from "@renderer/components/ui/Buttons"
import DropdownSection from "@renderer/components/ui/DropdownSection"
import { StickyMenuWrapper, StickyMenuGroupWrapper, StickyMenuGroup, StickyMenuBreadcrumbs, GoBackButton, GoToTopButton } from "@renderer/components/ui/StickyMenu"

function InfoAndHelpPage(): JSX.Element {
  const { t } = useTranslation()

  const [appVersion, setAppVersion] = useState("")
  const [os, setOs] = useState("")
  const [logsFolder, setLogsFolder] = useState("")

  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    ;(async (): Promise<void> => {
      setAppVersion(await window.api.utils.getAppVersion())
      setOs(await window.api.utils.getOs())
      setLogsFolder(await window.api.pathsManager.formatPath([await window.api.pathsManager.getCurrentUserDataPath(), "Logs"]))
    })()
  }, [])

  const links = [
    { icon: <PiGithubLogoDuotone />, to: import.meta.env.VITE_ISSUES_URL ?? "", text: t("generic.issues") },
    { icon: <PiInfoDuotone />, to: import.meta.env.VITE_DOCS_URL ?? "", text: t("generic.guides") },
    { icon: <PiUsersThreeDuotone />, to: import.meta.env.VITE_COMMUNITY_URL ?? "", text: "Community" },
    { icon: <PiCoinsDuotone />, to: import.meta.env.VITE_DONATE_URL ?? "", text: t("generic.donate") },
    { icon: <PiGithubLogoDuotone />, to: import.meta.env.VITE_SOURCE_URL ?? "", text: t("generic.source") }
  ].filter((link) => Boolean(link.to))

  return (
    <ScrollableContainer ref={scrollRef}>
      <div className="min-h-full flex flex-col items-center justify-center gap-2">
        <StickyMenuWrapper scrollRef={scrollRef}>
          <StickyMenuGroupWrapper>
            <StickyMenuGroup>
              <GoBackButton to="/" />
            </StickyMenuGroup>

            <StickyMenuBreadcrumbs breadcrumbs={[{ name: t("breadcrumbs.infoAndHelp"), to: "/info-and-help" }]} />

            <StickyMenuGroup>
              <GoToTopButton scrollRef={scrollRef} />
            </StickyMenuGroup>
          </StickyMenuGroupWrapper>
        </StickyMenuWrapper>

        <div className="w-[50rem] flex flex-col justify-center gap-6 my-auto">
          <h1 className="text-center text-4xl font-bold">{t("features.infoAndHelp.title")}</h1>

          {links.length > 0 && (
            <div className="w-full shrink-0 flex flex-wrap items-center justify-center gap-2">
              {links.map((link) => (
                <SocialButtons key={link.text} {...link} />
              ))}
            </div>
          )}

          <DropdownSection title={t("features.infoAndHelp.debugInfoTitle")} startOpen={false}>
            <p>{t("features.infoAndHelp.debugInfoDesc")}</p>

            <div className="select-all p-2 rounded-sm overflow-hidden border border-zinc-400/5 bg-zinc-950/50 enabled:shadow-sm enabled:shadow-zinc-950/50 enabled:hover:shadow-none enabled:cursor-pointer disabled:opacity-50">
              <p>EchoesLauncher v{appVersion}</p>
              <p>OS Type - {os}</p>
            </div>

            <p className="flex gap-1 items-center flex-wrap">
              <Trans
                i18nKey="features.infoAndHelp.includeLogs"
                components={{
                  folderlink: (
                    <NormalButton title={t("features.infoAndHelp.logsFolderTitle")} onClick={() => window.api.pathsManager.openPathOnFileExplorer(logsFolder)} className="text-vsl">
                      {t("features.infoAndHelp.thisFolder")}
                    </NormalButton>
                  )
                }}
              />
            </p>
          </DropdownSection>
        </div>
      </div>
    </ScrollableContainer>
  )
}

function SocialButtons({ icon, to, text }: { icon: JSX.Element; to: string; text: string }): JSX.Element {
  return (
    <FormButton
      title={text}
      onClick={() => window.api.utils.openOnBrowser(to)}
      className={
        "text-lg backdrop-blur-xs border border-zinc-400/5 bg-zinc-950/50 shadow-sm shadow-zinc-950/50 hover:shadow-none flex items-center justify-center gap-1 rounded-sm cursor-pointer px-1 duration-200"
      }
    >
      {icon}
      <span>{text}</span>
    </FormButton>
  )
}

export default InfoAndHelpPage
