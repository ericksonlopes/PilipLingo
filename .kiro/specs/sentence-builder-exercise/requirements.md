# Requirements Document

## Introduction

O modo SENTENCE_BUILDER é o sexto modo de exercício do PilipLingo. O aluno vê apenas o `focus_term` (palavra-alvo em inglês) e a sua tradução em português (`focus_term_translation`), e deve escrever livremente uma frase em inglês que contenha esse termo. Nenhuma frase de exemplo é exibida. Após a submissão, o sistema valida (1) se o termo-alvo está presente na frase e (2) se a frase tem gramática mínima aceitável — tudo no cliente, sem LLM, sem custo e com suporte offline/PWA.

A validação gramatical client-side usa a biblioteca **compromise.js** (licença MIT, ~240 KB minificado+gzip), que reconhece POS tags, verbos, sujeitos e pontuação básica em inglês. Ela opera completamente offline, não requer chave de API e tem latência < 50 ms em mobile para frases curtas. LanguageTool API pública foi descartada por exigir conectividade e ter latência imprevisível; Wink NLP foi descartado por tamanho excessivo de modelo (> 2 MB); heurísticas puras sem biblioteca foram descartadas por rejeitar excessivamente frases válidas de níveis A1–A2.

O exercício segue o mesmo ciclo dos demais modos: o aluno resolve → recebe feedback correto/incorreto → o card é agendado pelo SM-2 existente via `register_review`.

---

## Glossary

- **SentenceBuilder**: componente React responsável pela UI do modo SENTENCE_BUILDER.
- **SentenceBuilderValidator**: módulo TypeScript (client-side) que executa as duas regras de validação: presença do termo-alvo e gramática mínima via compromise.js.
- **ExerciseMode**: enum (`StrEnum`) no backend com os modos de exercício; atualmente com 5 valores.
- **StudyCard**: entidade de domínio que representa uma frase em estudo com agendamento SM-2.
- **StudyExercise**: estrutura que transporta os dados de um exercício para o frontend, incluindo `mode`, `prompt`, `answer`, `card`.
- **focus_term**: palavra ou expressão em inglês que é o objeto de aprendizado do `StudyCard`.
- **focus_term_translation**: tradução em português do `focus_term`.
- **ReviewGrade**: enum com os valores `AGAIN`, `HARD`, `GOOD`, `EASY` que aciona o SM-2.
- **compromise.js**: biblioteca NLP JavaScript, licença MIT, executada inteiramente no cliente.
- **GradeBar**: componente React que exibe os botões `AGAIN / HARD / GOOD / EASY` após resolução.

---

## Requirements

### Requirement 1: Registro do modo no backend

**User Story:** Como desenvolvedor, quero que `SENTENCE_BUILDER` seja um valor válido do enum `ExerciseMode`, para que o backend possa montar e serializar exercícios desse modo.

#### Acceptance Criteria

1. THE `ExerciseMode` SHALL include the value `SENTENCE_BUILDER` as a member of the `StrEnum`.
2. THE `ExerciseMode.SENTENCE_BUILDER` SHALL have the `instruction` property returning the string `"Escreva uma frase em inglês usando a palavra indicada."`.
3. THE `ExerciseMode.SENTENCE_BUILDER` SHALL have the `needs_audio` property returning `False`.
4. THE `ExerciseMode.SENTENCE_BUILDER` SHALL have the `is_group` property returning `False`.

---

### Requirement 2: Montagem do exercício no backend

**User Story:** Como sistema, quero que `build_exercise` produza um `StudyExercise` correto para o modo `SENTENCE_BUILDER`, para que o frontend receba apenas as informações necessárias, sem expor a frase de exemplo.

#### Acceptance Criteria

1. WHEN `build_exercise` is called with a `StudyCard` and `ExerciseMode.SENTENCE_BUILDER`, THE `StudyCard` SHALL produce a `StudyExercise` where `prompt` is the `focus_term` of the card.
2. WHEN `build_exercise` is called with a `StudyCard` and `ExerciseMode.SENTENCE_BUILDER`, THE `StudyCard` SHALL produce a `StudyExercise` where `answer` is an empty string.
3. WHEN `build_exercise` is called with a `StudyCard` and `ExerciseMode.SENTENCE_BUILDER`, THE `StudyCard` SHALL produce a `StudyExercise` where `blocks` is an empty list.
4. THE `StudyExercise` for mode `SENTENCE_BUILDER` SHALL NOT include the `sentence` field value of the `StudyCard` in `prompt`, `answer`, or `blocks`.

---

### Requirement 3: Inclusão do modo na sessão de estudo

**User Story:** Como aluno, quero que `SENTENCE_BUILDER` possa ser selecionado nas opções de sessão, para que eu possa praticar criação livre de frases.

#### Acceptance Criteria

1. THE `StudyOptionsResponse` SHALL include `SENTENCE_BUILDER` in the list of available modes returned by the `/study/options` endpoint.
2. WHEN a `StudySessionQuery` includes `ExerciseMode.SENTENCE_BUILDER` in `modes`, THE `assemble_session` SHALL assign `ExerciseMode.SENTENCE_BUILDER` to eligible single-card exercises.
3. THE `_SINGLE_CARD_MODES` tuple SHALL include `ExerciseMode.SENTENCE_BUILDER` so that `SENTENCE_BUILDER` is eligible for random assignment in mixed sessions.
4. THE `StudySessionResponse` SHALL serialize a `SENTENCE_BUILDER` exercise with `focus_term_translation` included inside the `card` object.

---

### Requirement 4: Tipo e enum no frontend

**User Story:** Como desenvolvedor frontend, quero que `SENTENCE_BUILDER` esteja declarado nos tipos TypeScript do projeto, para que o switch de modo no `ExerciseView` cubra o novo caso sem erros de compilação.

#### Acceptance Criteria

1. THE `EXERCISE_MODES` constant in `types.ts` SHALL include `"SENTENCE_BUILDER"` as a member of the readonly tuple.
2. THE `ExerciseMode` type in `types.ts` SHALL include `"SENTENCE_BUILDER"` as a valid string literal.
3. WHEN TypeScript compiles the frontend with `npm run build`, THE build SHALL complete without type errors related to `SENTENCE_BUILDER`.

---

### Requirement 5: Módulo de validação client-side

**User Story:** Como sistema, quero que a validação da resposta do aluno seja executada inteiramente no cliente, sem chamadas de rede, para que o exercício funcione offline.

#### Acceptance Criteria

1. THE `SentenceBuilderValidator` SHALL verify that the `focus_term` appears in the submitted sentence using a case-insensitive, whole-word match.
2. WHEN the submitted sentence does not contain the `focus_term` as a whole word, THE `SentenceBuilderValidator` SHALL return `{ valid: false, reason: "missing_term" }`.
3. THE `SentenceBuilderValidator` SHALL verify minimum grammar by checking that the sentence, after punctuation normalization, contains at least one token identified as a verb by compromise.js.
4. WHEN the submitted sentence contains the `focus_term` but no verb token is detected by compromise.js, THE `SentenceBuilderValidator` SHALL return `{ valid: false, reason: "no_verb" }`.
5. WHEN the submitted sentence contains the `focus_term` and at least one verb token, THE `SentenceBuilderValidator` SHALL return `{ valid: true }`.
6. THE `SentenceBuilderValidator` SHALL execute the full validation in under 100 ms on a mid-range Android device for sentences up to 30 words.
7. THE `SentenceBuilderValidator` SHALL operate without any network request.

---

### Requirement 6: Componente SentenceBuilder

**User Story:** Como aluno, quero ver o `focus_term` e a sua tradução em português antes de escrever, para que eu saiba o que preciso usar na frase, sem receber a frase de exemplo como dica.

#### Acceptance Criteria

1. THE `SentenceBuilder` SHALL display the `focus_term` from `exercise.prompt` as the primary visual element before the student submits.
2. WHEN `exercise.card.focus_term_translation` is not null, THE `SentenceBuilder` SHALL display the `focus_term_translation` as a secondary label below the `focus_term`.
3. THE `SentenceBuilder` SHALL NOT render the `exercise.card.sentence` at any point during the input phase.
4. THE `SentenceBuilder` SHALL render a `<textarea>` with `aria-label="Escreva sua frase em inglês"` for the student's input.
5. THE `SentenceBuilder` SHALL render a submit button labeled `"Verificar"` that remains disabled while the `<textarea>` is empty or contains only whitespace.
6. WHEN the student submits, THE `SentenceBuilder` SHALL call `SentenceBuilderValidator` with the submitted text and the `focus_term`.
7. WHEN `SentenceBuilderValidator` returns `{ valid: true }`, THE `SentenceBuilder` SHALL call `onResolve(true)`.
8. WHEN `SentenceBuilderValidator` returns `{ valid: false, reason: "missing_term" }`, THE `SentenceBuilder` SHALL call `onResolve(false)` and display the feedback message `"Sua frase precisa conter a palavra «{focus_term}»."`.
9. WHEN `SentenceBuilderValidator` returns `{ valid: false, reason: "no_verb" }`, THE `SentenceBuilder` SHALL call `onResolve(false)` and display the feedback message `"A frase parece incompleta — adicione um verbo."`.
10. WHILE `isResolved` is true, THE `SentenceBuilder` SHALL render the `exercise.card.sentence` as a reference example with the label `"Exemplo do card:"`.
11. WHILE `isResolved` is true, THE `SentenceBuilder` SHALL disable the `<textarea>` and the submit button.
12. THE `SentenceBuilder` SHALL follow the same CSS class conventions (`exercise`, `exercise__sentence`, `exercise__feedback`, `exercise__actions`, `btn`, `btn--primary`, `btn--block`, `feedback`, `feedback--ok`, `feedback--bad`) used by the existing exercise components.

---

### Requirement 7: Integração no ExerciseView e roteamento

**User Story:** Como sistema, quero que o `ExerciseView` renderize `SentenceBuilder` para exercícios do modo `SENTENCE_BUILDER`, para que o ciclo de estudo funcione sem erros de runtime.

#### Acceptance Criteria

1. THE `ExerciseView` switch statement in `StudyPage.tsx` SHALL include a `case "SENTENCE_BUILDER"` branch that renders the `SentenceBuilder` component.
2. THE `case "SENTENCE_BUILDER"` SHALL pass `exercise`, `isResolved`, and `onResolve` as props to `SentenceBuilder`.
3. IF TypeScript's exhaustive check detects that `ExerciseMode` has an unhandled case in `ExerciseView`, THEN THE compiler SHALL emit a type error (the switch must remain exhaustive).

---

### Requirement 8: Feedback pós-resolução e agendamento SM-2

**User Story:** Como aluno, quero que meu resultado no SENTENCE_BUILDER agende o card normalmente, para que o exercício contribua para meu progresso como os outros modos.

#### Acceptance Criteria

1. WHEN `onResolve(wasCorrect)` is called by `SentenceBuilder`, THE `StudyPage` SHALL follow the same resolution flow used by the other exercise modes, displaying `GradeBar` and awaiting the student's `ReviewGrade`.
2. WHEN the student selects a `ReviewGrade` after a `SENTENCE_BUILDER` exercise, THE `StudyPage` SHALL call `PATCH /study/cards/{id}/review` with the selected grade, identical to the other modes.
3. THE SM-2 scheduling logic in `StudyCard.register_review` SHALL execute without modification for reviews originating from `SENTENCE_BUILDER` exercises.

---

### Requirement 9: Dependência compromise.js

**User Story:** Como desenvolvedor, quero que compromise.js seja adicionado como dependência declarada do projeto, para que a instalação seja reproduzível e auditável.

#### Acceptance Criteria

1. THE `package.json` of the frontend SHALL declare `compromise` as a production dependency with a pinned version (no open ranges).
2. WHEN `npm install` is run in the frontend directory, THE `node_modules/compromise` directory SHALL be present and importable.
3. THE `SentenceBuilderValidator` SHALL import compromise using a static `import` statement so that the build bundler can tree-shake unused modules.
4. IF the compromise.js bundle increases the frontend initial chunk by more than 150 KB (gzip), THEN THE `SentenceBuilderValidator` SHALL load compromise via dynamic `import()` so that the chunk is lazily loaded on first use.
