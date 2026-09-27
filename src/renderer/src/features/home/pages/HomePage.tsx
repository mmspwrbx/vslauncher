import { useTranslation } from "react-i18next"

function HomePage(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">{t("features.home.title")}</h1>
    </div>
  )
}

export default HomePage
