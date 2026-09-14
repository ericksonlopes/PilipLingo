# Design Document — sentence-builder-exercise

## Overview

O modo `SENTENCE_BUILDER` é o sexto modo de exercício do PilipLingo. O aluno vê apenas o `focus_term` e sua tradução em português, escreve livremente uma frase em inglês e recebe validação imediata, inteiramente no cliente, sem nenhuma chamada de rede.

A implementação se divide em quatro camadas independentes:

1. **Backend – domínio** (`study.py`): adição do valor ao `ExerciseMode` e ao `build_exercise`.
2. **Backend – API** (`routes.py`, `schemas.py`): exposição do modo nos endpoints existentes.
3. **Frontend – validação** (`sentenceBuilderValidator.ts`): módulo puro que executa as duas regras.
4. **Frontend – UI** (`SentenceBuilder.tsx` + `StudyPage.tsx`): componente e roteamento.

Nenhuma tabela nova, nenhuma migração, nenhum endpoint novo. O fluxo SM-2 existente absorve o modo sem modificação.

---

## Architecture

### Fluxo end-to-end

```
┌─────────────────────────────────────────────────────┐
│ Backend                                             │
│  ExerciseMode.SENTENCE_BUILDER (StrEnum)            │
│  build_exercise → StudyExercise(prompt=focus_term,  │
│                                 answer="",          │
│                                 blocks=[])          │
│  /study/options → inclui SENTENCE_BUILDER           │
│  /study/today   → serializa exercise + card         │
└────────────────────────┬────────────────────────────┘
                         │ JSON (HTTP)
┌────────────────────────▼────────────────────────────┐
│ Frontend                                            │
│  StudyPage → ExerciseView switch                    │
│    case "SENTENCE_BUILDER" → SentenceBuilder        │
│      └─ SentenceBuilderValidator (client-side)      │
│           ├─ whole-word match (focus_term)          │
│           └─ compromise.js verb detection           │
│  onResolve → GradeBar → PATCH /study/{id}/review    │
└─────────────────────────────────────────────────────┘
```

### Princípios de design

- **Zero custo de infraestrutura:** validação 100% client-side; nenhum endpoint novo.
- **Offline-first:** compromise.js é bundlado estaticamente; nenhuma rede é requerida.
- **Extensibilidade mínima:** `ExerciseMode` cresce com um único valor; `build_exercise` cresce com um único branch; `ExerciseView` cresce com um único `case`.
- **Nenhuma exposição da frase:** `prompt=focus_term`, `answer=""`, `blocks=[]` — a frase-exemplo permanece apenas no objeto `card` e só é exibida pós-resolução.

---

## Components and Interfaces

### Backend — `ExerciseMode` (study.py)

Adicionar o membro ao `StrEnum` e suas propriedades calculadas:

```python
class ExerciseMode(StrEnum):
    TYPING_CLOZE       = "TYPING_CLOZE"
    AUDIO_DICTATION    = "AUDIO_DICTATION"
    BLOCK_TRANSLATION  = "BLOCK_TRANSLATION"
    VOCAB_MATCHING     = "VOCAB_MATCHING"
    SPEAKING_PRACTICE  = "SPEAKING_PRACTICE"
    SENTENCE_BUILDER   = "SENTENCE_BUILDER"   # ← novo

    @property
    def needs_audio(self) -> bool:
        return self in {ExerciseMode.AUDIO_DICTATION, ExerciseMode.SPEAKING_PRACTICE}
        # SENTENCE_BUILDER não está no conjunto → False

    @property
    def is_group(self) -> bool:
        return self is ExerciseMode.VOCAB_MATCHING
        # SENTENCE_BUILDER → False
```

Entrada no dicionário de instruções:

```python
_INSTRUCTIONS: dict[ExerciseMode, str] = {
    ...
    ExerciseMode.SENTENCE_BUILDER: "Escreva uma frase em inglês usando a palavra indicada.",
}
```

Adição a `_SINGLE_CARD_MODES`:

```python
_SINGLE_CARD_MODES: tuple[ExerciseMode, ...] = (
    ExerciseMode.TYPING_CLOZE,
    ExerciseMode.AUDIO_DICTATION,
    ExerciseMode.BLOCK_TRANSLATION,
    ExerciseMode.SPEAKING_PRACTICE,
    ExerciseMode.SENTENCE_BUILDER,   # ← novo
)
```

### Backend — `build_exercise` (study.py)

Novo branch (inserido antes do fallback `VOCAB_MATCHING`):

```python
if mode is ExerciseMode.SENTENCE_BUILDER:
    return StudyExercise(
        mode=mode,
        card=card,
        prompt=card.focus_term,
        answer="",
        blocks=[],
    )
```

### Backend — `routes.py`

Adicionar o modo ao dicionário de labels:

```python
_STUDY_MODE_LABELS: dict[ExerciseMode, str] = {
    ExerciseMode.TYPING_CLOZE:      "Completar lacuna",
    ExerciseMode.AUDIO_DICTATION:   "Ditado",
    ExerciseMode.BLOCK_TRANSLATION: "Ordenar tradução",
    ExerciseMode.SPEAKING_PRACTICE: "Praticar fala",
    ExerciseMode.SENTENCE_BUILDER:  "Criar frase",   # ← novo
}
```

### Frontend — tipos (types.ts)

```typescript
export const EXERCISE_MODES = [
  "TYPING_CLOZE",
  "AUDIO_DICTATION",
  "BLOCK_TRANSLATION",
  "VOCAB_MATCHING",
  "SPEAKING_PRACTICE",
  "SENTENCE_BUILDER",   // ← novo
] as const;

export type ExerciseMode = (typeof EXERCISE_MODES)[number];
```

### Frontend — `SentenceBuilderValidator` (sentenceBuilderValidator.ts)

Módulo puro (sem estado, sem I/O) que exporta uma função e um tipo de retorno:

```typescript
import nlp from "compromise";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: "missing_term" }
  | { valid: false; reason: "no_verb" };

/**
 * Valida a frase submetida pelo aluno.
 *
 * Regra 1 — presença do focus_term: correspondência whole-word, case-insensitive.
 * Regra 2 — gramática mínima: a frase, após normalização de pontuação, deve
 *            conter ao menos um token classificado como verbo pelo compromise.js.
 *
 * Executa inteiramente no cliente; não faz chamadas de rede.
 */
export function validateSentence(
  sentence: string,
  focusTerm: string,
): ValidationResult {
  // Regra 1: whole-word match, case-insensitive
  const escaped = focusTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const termRegex = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
  if (!termRegex.test(sentence)) {
    return { valid: false, reason: "missing_term" };
  }

  // Regra 2: ao menos um verbo detectado pelo compromise.js
  const doc = nlp(sentence);
  if (doc.verbs().length === 0) {
    return { valid: false, reason: "no_verb" };
  }

  return { valid: true };
}
```

**Notas de implementação:**
- A função é **pura** (sem side effects), facilitando testes.
- O `import` é estático para que o bundler Vite inclua o módulo no chunk principal. Se o tamanho gzip do chunk inicial ultrapassar 150 KB após adição do compromise.js, migrar para `import()` dinâmico (lazy-load na primeira chamada do validator).
- O regex de whole-word usa lookahead/lookbehind `(?<![\\w])...(?![\\w])` em vez de `\\b` para lidar corretamente com termos que começam ou terminam com apóstrofo (ex.: "it's").

### Frontend — `SentenceBuilder` (SentenceBuilder.tsx)

```typescript
interface SentenceBuilderProps {
  exercise: StudyExercise;
  isResolved: boolean;
  onResolve: (wasCorrect: boolean) => void;
}
```

Estados internos:
- `text: string` — conteúdo do textarea.
- `feedback: string | null` — mensagem de erro pós-validação (null = nenhuma ou correto).

Comportamento por estado:

| Estado | textarea | botão | feedback |
|--------|----------|-------|----------|
| Inicial | habilitado, vazio | desabilitado | — |
| Digitando (whitespace only) | habilitado | desabilitado | — |
| Digitando (texto válido) | habilitado | habilitado | — |
| Resolvido (válido) | desabilitado | desabilitado | — |
| Resolvido (missing_term) | desabilitado | desabilitado | mensagem |
| Resolvido (no_verb) | desabilitado | desabilitado | mensagem |

Após `isResolved = true`, o componente exibe a frase-exemplo do card.

### Frontend — `ExerciseView` (StudyPage.tsx)

Adicionar o `case` ao switch existente:

```typescript
case "SENTENCE_BUILDER":
  return (
    <SentenceBuilder
      exercise={exercise}
      isResolved={isResolved}
      onResolve={onResolve}
    />
  );
```

O TypeScript verificará exaustividade automaticamente (o tipo `ExerciseMode` cobre todos os casos; o branch `default` inexistente causaria erro de compilação se um caso ficasse descoberto).

---

## Data Models

Nenhum modelo novo. As entidades existentes absorvem o modo:

| Entidade | Campo afetado | Mudança |
|----------|--------------|---------|
| `ExerciseMode` | — | +1 membro `SENTENCE_BUILDER` |
| `StudyExercise` (domínio) | `prompt`, `answer`, `blocks` | preenchidos conforme build_exercise |
| `StudyExerciseResponse` (schema) | — | sem mudança; `from_entity` já serializa corretamente |
| `StudyCardResponse` | `focus_term_translation` | já existe; nenhuma mudança |
| `EXERCISE_MODES` (frontend) | — | +1 literal `"SENTENCE_BUILDER"` |

---

## Error Handling

| Cenário | Tratamento |
|---------|-----------|
| `focus_term` não encontrado na frase (case / partial) | `validateSentence` retorna `{ valid: false, reason: "missing_term" }`; SentenceBuilder exibe `"Sua frase precisa conter a palavra «{focus_term}»."` |
| Frase sem verbo detectável | `validateSentence` retorna `{ valid: false, reason: "no_verb" }`; SentenceBuilder exibe `"A frase parece incompleta — adicione um verbo."` |
| Textarea vazio / só whitespace | Botão "Verificar" permanece `disabled`; nunca chama o validator |
| compromise.js não disponível (erro de import) | O import estático falha em build-time, não em runtime; o bundle não será gerado — detectado pela etapa `npm run build` da CI |
| `SENTENCE_BUILDER` em `assemble_session` com `modes=()` | Tratado pela guarda existente: `raise ValidationError("Selecione pelo menos um modo.")` |
| Card sem `focus_term_translation` | `SentenceBuilder` condiciona o label: `{exercise.card.focus_term_translation && <span>...` — renderiza nada se `null` |

---

## Dependency: compromise.js

- **Versão a fixar:** a mais recente estável ao momento da implementação (ex.: `14.14.4`), sem range aberto.
- **Declaração:** `"compromise": "14.14.4"` em `dependencies` (produção) do `package.json` do frontend.
- **Import:** `import nlp from "compromise"` (CJS interop via Vite); o bundler tree-shake módulos não usados.
- **Tamanho estimado:** ~88 KB minificado + gzip (chunk lazy se ultrapassar 150 KB gzip no chunk inicial).

---

## CSS Conventions

`SentenceBuilder` segue exatamente as classes usadas pelos demais modos:

```
.exercise
  .exercise__sentence          ← focus_term (elemento primário)
  .exercise__hint              ← focus_term_translation
  <textarea aria-label="…">   ← campo de escrita
  .exercise__actions
    .btn.btn--primary.btn--block  ← "Verificar"
  .exercise__feedback
    .feedback.feedback--ok / .feedback.feedback--bad  ← resultado
    .exercise__sentence         ← frase-exemplo (pós-resolução, label "Exemplo do card:")
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: build_exercise SENTENCE_BUILDER expõe apenas o focus_term

*For any* `StudyCard` com qualquer conteúdo de frase, `build_exercise(card, ExerciseMode.SENTENCE_BUILDER)` deve produzir um `StudyExercise` onde `prompt == card.focus_term`, `answer == ""` e `blocks == []` — ou seja, nenhum campo vaza o conteúdo de `card.sentence`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 2: assemble_session respeita o modo selecionado

*For any* lista não-vazia de `StudyCard`s, chamar `assemble_session(cards, modes=(ExerciseMode.SENTENCE_BUILDER,))` deve produzir uma sessão onde todo exercício tem `mode == ExerciseMode.SENTENCE_BUILDER`.

**Validates: Requirements 3.2**

---

### Property 3: validateSentence — whole-word match

*For any* par `(sentence, focusTerm)` tal que `sentence` contenha `focusTerm` como palavra inteira (ignorando capitalização), `validateSentence` não deve retornar `{ valid: false, reason: "missing_term" }`. *For any* par onde `focusTerm` aparece apenas como subcadeia de outra palavra (ex.: "running" quando o termo é "run"), `validateSentence` deve retornar `{ valid: false, reason: "missing_term" }`.

**Validates: Requirements 5.1, 5.2**

---

### Property 4: validateSentence — verbo obrigatório

*For any* sentença que contenha o `focusTerm` como palavra inteira e também contenha ao menos um verbo reconhecido pelo compromise.js, `validateSentence` deve retornar `{ valid: true }`. *For any* sentença com o `focusTerm` como palavra inteira mas sem nenhum verbo detectável, deve retornar `{ valid: false, reason: "no_verb" }`.

**Validates: Requirements 5.3, 5.4, 5.5**

---

### Property 5: SentenceBuilder — botão desabilitado para entradas vazias

*For any* string composta inteiramente de caracteres whitespace (incluindo a string vazia), o botão "Verificar" do `SentenceBuilder` deve permanecer desabilitado (`disabled`) e nenhuma chamada ao validator deve ocorrer.

**Validates: Requirements 6.5**

---

### Property 6: SentenceBuilder — mapeamento resultado do validator → onResolve + feedback

*For any* resultado de `validateSentence`:
- `{ valid: true }` → `onResolve(true)` é chamado e nenhuma mensagem de feedback de erro é renderizada.
- `{ valid: false, reason: "missing_term" }` → `onResolve(false)` é chamado e o feedback exibe a mensagem contendo o `focus_term`.
- `{ valid: false, reason: "no_verb" }` → `onResolve(false)` é chamado e o feedback exibe a mensagem sobre verbo.

**Validates: Requirements 6.7, 6.8, 6.9**

---

## Testing Strategy

### Backend — Testes baseados em propriedades (pytest + Hypothesis)

**`test_build_exercise_sentence_builder.py`**

- Propriedade: para qualquer `StudyCard` gerado pela estratégia Hypothesis, `build_exercise(card, ExerciseMode.SENTENCE_BUILDER)` produz `prompt == card.focus_term`, `answer == ""` e `blocks == []`.
- Propriedade: para qualquer lista não-vazia de cards, `assemble_session(cards, modes=(ExerciseMode.SENTENCE_BUILDER,))` produz uma sessão onde todo exercício tem `mode == ExerciseMode.SENTENCE_BUILDER`.

### Frontend — Testes baseados em propriedades (vitest + fast-check)

**`sentenceBuilderValidator.property.test.ts`**

- Propriedade whole-word: para qualquer `(sentence, focusTerm)` em que o termo aparece como palavra inteira, `validateSentence` não retorna `missing_term`.
- Propriedade subcadeia: para qualquer par em que o termo ocorre apenas como subcadeia (ex.: `"run"` dentro de `"running"`), `validateSentence` retorna `{ valid: false, reason: "missing_term" }`.
- Propriedade verbo obrigatório: para sentenças com o termo presente e pelo menos um verbo reconhecido pelo compromise.js, `validateSentence` retorna `{ valid: true }`.
- Propriedade sem verbo: para sentenças com o termo mas sem verbos, retorna `{ valid: false, reason: "no_verb" }`.

### Frontend — Testes de componente (vitest + Testing Library)

**`SentenceBuilder.test.tsx`**

- Botão "Verificar" está `disabled` quando o textarea está vazio ou contém apenas whitespace.
- Botão "Verificar" é habilitado após digitar texto não-vazio.
- Submit com resultado `{ valid: true }` chama `onResolve(true)` e não exibe mensagem de erro.
- Submit com `missing_term` chama `onResolve(false)` e exibe mensagem contendo o `focus_term`.
- Submit com `no_verb` chama `onResolve(false)` e exibe mensagem sobre verbo.
- Após `isResolved = true`, o textarea fica desabilitado e a frase-exemplo do card é exibida.

### E2E — Smoke test (Playwright)

- Abre uma sessão com `SENTENCE_BUILDER` habilitado, digita uma frase válida contendo o `focus_term` e um verbo, clica em "Verificar" e confirma que o fluxo de revisão SM-2 é acionado (PATCH `/study/{id}/review` recebido com `correct: true`).
