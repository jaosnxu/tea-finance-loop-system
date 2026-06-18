import { requirePageAccess } from "@/lib/auth";
import ExchangeRatesPage from "@/app/dashboard/settings/exchange-rates/page";

export default async function RulesExchangeRatesPage() {
  await requirePageAccess("settings_exchange_rates");
  return <ExchangeRatesPage />;
}
