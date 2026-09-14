import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import type { ProficiencyLevel } from "../lib/types";

interface AppShellProps {
  children: ReactNode;
  level: ProficiencyLevel;
  onChangeLevel: () => void;
  username?: string;
  onLogout?: () => void;
}

// Três abas: estudar, historico, chat e traduzir.
const TABS = [
  { to: "/", label: "Estudar", icon: "sparkle" },
  { to: "/historico", label: "Historico", icon: "history" },
  { to: "/chat", label: "Chat", icon: "chat" },
  { to: "/traduzir", label: "Traduzir", icon: "translate" },
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
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-logo" aria-hidden="true">
          P
        </span>
        <div className="app-header__text">
          <h1 className="app-title">PilipLingo</h1>
          <p className="app-subtitle">Ingles no seu ritmo</p>
        </div>
        <button
          type="button"
          className="level-chip"
          onClick={onChangeLevel}
          aria-label={`Seu nivel: ${level}. Toque para alterar`}
        >
          {level}
        </button>
        {onLogout ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onLogout}
            aria-label={username ? `Sair da conta ${username}` : "Sair da conta"}
            title={username ? `Sair (${username})` : "Sair"}
          >
            Sair
          </button>
        ) : null}
      </header>

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
