import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import LevelPicker from "./components/LevelPicker";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import HistoryPage from "./pages/HistoryPage";
import StudyPage from "./pages/StudyPage";
import TranslatePage from "./pages/TranslatePage";
import { useAuth } from "./hooks/useAuth";
import { useLevel } from "./hooks/useLevel";
import type { AuthUser } from "./lib/types";

export default function App() {
  const auth = useAuth();

  // While validating stored token, prevent flashing login screen.
  if (auth.loading) {
    return (
      <div className="app-shell app-shell--onboarding">
        <p className="level-picker__text">Carregando...</p>
      </div>
    );
  }

  // Without active session: show login/register before anything else.
  if (!auth.isAuthenticated || !auth.user) {
    return (
      <div className="app-shell app-shell--onboarding">
        <AuthPage onLogin={auth.login} onRegister={auth.register} />
      </div>
    );
  }

  return <AuthenticatedApp user={auth.user} onLogout={auth.logout} />;
}

interface AuthenticatedAppProps {
  user: AuthUser;
  onLogout: () => void;
}

/** Main authenticated app wrapper. */
function AuthenticatedApp({ user, onLogout }: AuthenticatedAppProps) {
  const [isChangingLevel, setIsChangingLevel] = useState(false);
  const { level, setLevel, hasLevel } = useLevel();

  // First launch: user selects initial proficiency level.
  if (!hasLevel || !level) {
    return (
      <div className="app-shell app-shell--onboarding">
        <LevelPicker current={null} onSelect={setLevel} />
      </div>
    );
  }

  return (
    <AppShell
      level={level}
      onChangeLevel={() => setIsChangingLevel(true)}
      username={user.username}
      onLogout={onLogout}
    >
      {isChangingLevel ? (
        <LevelPicker
          current={level}
          onSelect={(next) => {
            setLevel(next);
            setIsChangingLevel(false);
          }}
          onCancel={() => setIsChangingLevel(false)}
        />
      ) : (
        <Routes>
          <Route path="/" element={<StudyPage level={level} />} />
          <Route path="/historico" element={<HistoryPage level={level} />} />
          <Route path="/chat" element={<ChatPage level={level} />} />
          <Route path="/traduzir" element={<TranslatePage />} />
          <Route path="/historias" element={<Navigate to="/" replace />} />
          <Route path="/frases" element={<Navigate to="/" replace />} />
          <Route path="/praticar" element={<Navigate to="/" replace />} />
          <Route path="/vocabulario" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AppShell>
  );
}
