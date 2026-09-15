import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import SettingsModal from "./SettingsModal";
import type { ProficiencyLevel } from "../lib/types";

interface AppShellProps {
  children: ReactNode;
  level: ProficiencyLevel;
  onChangeLevel: () => void;
  username?: string;
  onLogout?: () => void;
}

// Quatro abas principais: Estudar, Chat, Traduzir e Histórico à direita.
const TABS = [
  { to: "/", label: "Estudar", icon: "sparkle" },
  { to: "/chat", label: "Chat", icon: "chat" },
  { to: "/traduzir", label: "Traduzir", icon: "translate" },
  { to: "/historico", label: "Histórico", icon: "history" },
] as const;

type IconName = (typeof TABS)[number]["icon"];

/** Layout mobile-first: header compacto + conteudo scrollavel + tab bar fixa. */
export default function AppShell({
  children,
  level,
  onChangeLevel,
  username,
  onLogout,
}: AppShellProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="app-header__profile"
          onClick={() => setIsSettingsOpen(true)}
          aria-label={`Perfil de ${username || "usuário"}. Toque para abrir configurações`}
          title="Ver perfil e configurações"
        >
          <div className="app-header__avatar" aria-hidden="true">
            {username ? username.trim().charAt(0).toUpperCase() : "U"}
          </div>
          <span className="app-header__username">
            {username || "Perfil"}
          </span>
        </button>

        <div className="app-header__actions">
          <button
            type="button"
            className="level-chip"
            onClick={onChangeLevel}
            aria-label={`Seu nível: ${level}. Toque para alterar`}
            title={`Nível de proficiência: ${level}. Toque para alterar`}
          >
            <span className="level-chip__dot" aria-hidden="true" />
            <span className="level-chip__label">Nível</span>
            <span className="level-chip__value">{level}</span>
            <svg
              className="level-chip__chevron"
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <button
            type="button"
            className="app-header__config-btn"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Configurações da conta"
            title="Configurações"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        username={username}
        level={level}
        onChangeLevel={onChangeLevel}
        onLogout={onLogout}
      />

      <main className="app-main" id="conteudo">
        {children}
      </main>

      <nav className="tab-bar" aria-label="Navegacao principal">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) => `tab${isActive ? " tab--active" : ""}`}
          >
            <TabIcon name={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function TabIcon({ name }: { name: IconName }) {
  if (name === "history") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 8v4l2.5 2.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M3.5 12A8.5 8.5 0 1 0 5 7.5L3 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M3 9.5V5.5H7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  if (name === "chat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  if (name === "translate") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M3 5h12M9 3v2M7 19l4-8 4 8M8.5 16h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M14 5l7 7-2 2M17 12l-3 3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M18 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
