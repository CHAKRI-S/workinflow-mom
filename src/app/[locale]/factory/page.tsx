import { setRequestLocale } from "next-intl/server";
import { FactoryBoard } from "./factory-board";

export default async function FactoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FactoryBoard />;
}
