import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** id do container renderizado dentro da barra fixa (.study-actions) na StudyPage. */
export const ACTION_BAR_SLOT_ID = "study-action-slot";

interface ActionBarSlotProps {
  children: ReactNode;
}

/**
 * Renderiza os botoes de acao do exercicio (ex.: "Verificar", "Dica") dentro da
 * barra fixa do rodape, sem precisar levantar o estado de cada modo para a pagina.
 *
 * Cada modo mantem sua propria logica; so o local de renderizacao muda via portal.
 * Se o alvo ainda nao existir no primeiro render, tenta de novo no efeito.
 */
export default function ActionBarSlot({ children }: ActionBarSlotProps) {
  const [target, setTarget] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.getElementById(ACTION_BAR_SLOT_ID) : null,
  );

  useEffect(() => {
    if (target === null) {
      setTarget(document.getElementById(ACTION_BAR_SLOT_ID));
    }
  }, [target]);

  if (target === null) {
    return null;
  }
  return createPortal(children, target);
}
