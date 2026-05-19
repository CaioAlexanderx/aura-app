import { Redirect } from "expo-router";

// /food/(salao) cai direto em /mesas (tela inicial do shell).
export default function FoodIndex() {
  return <Redirect href="/food/(salao)/mesas" />;
}
