import { useState } from "react";

import { ApiError } from "../lib/api";
import type { AuthCredentials } from "../lib/types";

type Mode = "login" | "register";

interface AuthPageProps {
  onLogin: (credentials: AuthCredentials) => Promise<void>;
  onRegister: (credentials: AuthCredentials) => Promise<void>;
}

/** Porta de entrada do app: login e cadastro simples de usuario + senha. */
export default function AuthPage({ onLogin, onRegister }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const credentials: AuthCredentials = {
        username: username.trim(),
        password,
      };
      await (isRegister ? onRegister(credentials) : onLogin(credentials));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Nao foi possivel entrar agora. Tente de novo.",
      );
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <section className="level-picker" aria-labelledby="auth-title">
      <header className="level-picker__head">
        <h2 id="auth-title" className="level-picker__title">
          {isRegister ? "Criar uma conta" : "Entrar no PilipLingo"}
        </h2>
        <p className="level-picker__text">
          {isRegister
            ? "Escolha um usuario e uma senha. Seu vocabulario fica so seu."
            : "Use seu usuario e senha para continuar de onde parou."}
        </p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Usuario</span>
          <input
            className="field__input"
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={40}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">
            Senha
            {isRegister ? <span className="field__hint"> (min. 6 caracteres)</span> : null}
          </span>
          <input
            className="field__input"
            type="password"
            name="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={isRegister ? 6 : 1}
            maxLength={128}
            required
          />
        </label>

        {error ? (
          <p className="field__hint" role="alert" style={{ color: "var(--danger, #ff6b6b)" }}>
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? "Enviando..." : isRegister ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => switchMode(isRegister ? "login" : "register")}
      >
        {isRegister ? "Ja tenho conta. Entrar" : "Criar uma conta nova"}
      </button>
    </section>
  );
}
