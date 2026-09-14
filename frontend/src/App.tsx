import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import LevelPicker from "./components/LevelPicker";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import HistoryPage from "./pages/HistoryPage";
import StudyPage from "./pages/StudyPage";
import { useAuth } from "./hooks/useAuth";
import { useLevel } from "./hooks/useLevel";
import type { AuthUser } from "./lib/types";

export default function App() {
  const auth = useAuth();

  // Enquanto revalidamos o token guardado, evita piscar a tela de login.
  if (auth.loading) {
    return (
      <div className="app-shell app-shell--onboarding">
        <p className="level-picker__text">Carregando...</p>
      </div>
    );
  }

  // Sem sessao: login/cadastro antes de qualquer outra coisa. Sem montar o app
  // (nem seus fetches) enquanto o usuario nao esta autenticado.
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

/** O app em si, montado apenas com um usuario logado (todos os fetches sao seguros). */
function AuthenticatedApp({ user, onLogout }: AuthenticatedAppProps) {
  const [isChangingLevel, setIsChangingLevel] = useState(false);
  const { level, setLevel, hasLevel } = useLevel();

  // Primeira abertura: o usuario informa o nivel antes de usar o app.
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
          <Route path="/frases" element={<Navigate to="/" replace />} />
          <Route path="/praticar" element={<Navigate to="/" replace />} />
          <Route path="/vocabulario" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AppShell>
  );
}
