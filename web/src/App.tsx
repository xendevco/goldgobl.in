import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ArbitragePage } from "@/pages/ArbitragePage";
import { DecorPage } from "@/pages/DecorPage";
import { LevellingPage } from "@/pages/LevellingPage";
import { ProfitsPage } from "@/pages/ProfitsPage";
import { RosterPage } from "@/pages/RosterPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RosterPage />} />
        <Route path="profits" element={<ProfitsPage />} />
        <Route path="decor" element={<DecorPage />} />
        <Route path="arbitrage" element={<ArbitragePage />} />
        <Route path="levelling" element={<LevellingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
