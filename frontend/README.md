# PilipLingo - frontend

Vite + React 19 + TypeScript. Interface mobile-first e instalavel como PWA.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173 (escuta em 0.0.0.0)
npm run build      # tsc -b + build de producao (gera o service worker)
npm run preview    # serve o build, use para testar o PWA
```

`/api` e encaminhado para `VITE_PROXY_TARGET` (default `http://localhost:8000`),
o que evita CORS em desenvolvimento. Veja `.env.example`.

## Estrutura

```
src/
├── main.tsx                 # bootstrap + BrowserRouter
├── App.tsx                  # rotas e estado compartilhado da busca
├── components/
│   ├── AppShell.tsx         # header + tab bar fixa (layout mobile)
│   ├── AddEntrySheet.tsx    # bottom sheet de cadastro
│   └── VocabularyCard.tsx
├── components/LevelPicker.tsx  # onboarding: usuario informa o nivel
├── components/study/        # um componente por modo de exercicio
│   ├── TypingCloze.tsx      # digitar a palavra que falta
│   ├── BlockAssembly.tsx    # montar a frase por blocos (ditado e traducao)
│   ├── VocabMatching.tsx    # ligar ingles x portugues
│   ├── SpeakingPractice.tsx # ouvir e repetir (Speech Recognition)
│   ├── ChunkAnalysis.tsx    # "Entender estrutura": a frase bloco por bloco
│   ├── AudioButton.tsx      # fala a frase com o SpeechSynthesis
│   └── GradeBar.tsx         # Continuar + switch de avanco automatico
├── pages/
│   ├── StudyPage.tsx        # menu de preparacao + sessao, um exercicio por vez
│   └── VocabularyPage.tsx   # busca, lista, FAB de adicionar
├── hooks/useStudySession.ts # fila da sessao + envio da revisao
├── hooks/useVocabulary.ts   # lista + mutacoes, busca com debounce
├── hooks/useLevel.ts        # nivel CEFR persistido em localStorage
├── lib/api.ts               # cliente HTTP tipado (ApiError)
├── lib/answers.ts           # correcao das respostas (normalizacao + similaridade)
├── lib/speech.ts            # fala e escuta nativas do navegador
├── lib/levels.ts            # rotulos dos niveis (render imediato/offline)
├── lib/types.ts             # contratos espelhando os schemas do backend
└── styles/global.css        # design tokens + layout responsivo
```

## A aba Estudar

Duas abas apenas: **Estudar** e **Vocabulario**. A aba Estudar abre um menu de
preparacao antes de carregar a sessao. Nele, o aluno marca um ou mais dos quatro
formatos e define o tema das frases novas. Todos os formatos chegam marcados; os
exercicios sao alternados apenas entre os selecionados. O catalogo vem de
`GET /vocabulary/study/options`; revisoes pendentes continuam aparecendo mesmo que
tenham outro tema.

`GET /vocabulary/study/today` recebe parametros `modes` repetidos e `theme`. Um unico
modo fixa todos os cards naquele formato; varios modos alternam entre a selecao.
A omissao de `modes` continua disponivel apenas para compatibilidade com clientes
antigos e inclui `VOCAB_MATCHING`. **Estudar mais** volta ao menu para permitir outra
configuracao.

Depois de responder, qualquer modo oferece **Entender estrutura**, que abre a analise
em blocos vinda do backend (`sentence_chunks`). O app reproduz a frase automaticamente
e mostra **Continuar**; acerto envia `GOOD`, enquanto erro envia `AGAIN` e recoloca o
exercicio no fim da fila da propria sessao. O switch **Avancar automaticamente** espera
a sintese ficar ociosa antes de seguir, e uma reproducao manual reinicia essa espera.

Enquanto o exercicio nao foi respondido existe **Pular este exercicio**. Pular nao e
uma nota: nada vai para o backend, o agendamento do card fica intacto e ele volta numa
sessao futura. Diferente do `Errei`, o exercicio pulado nao retorna ao fim da fila
atual, porque quem pula normalmente esta impedido de responder (sem microfone, sem
fone, ambiente barulhento) e reapresentar o mesmo obstaculo viraria um loop.

### Correcao no aparelho

`lib/answers.ts` corrige as respostas localmente, o que mantem a sessao instantanea
e utilizavel com rede ruim. A regra e ser exigente com a palavra e tolerante com o
resto: pontuacao, maiuscula e espaco duplo nao sao o que esta sendo ensinado.

Na pratica de fala a comparacao e por similaridade (75%), nao exata, porque o
reconhecimento do navegador troca palavras parecidas e engole artigos; exigir
transcricao perfeita mediria o microfone, nao o ingles.

### Fala e escuta

`lib/speech.ts` usa apenas API nativa: `SpeechSynthesis` para tocar a frase e
`SpeechRecognition` (com o prefixo `webkit` como alternativa) para ouvir o aluno.
Nenhum audio vai para o backend: nao ha custo de TTS nem upload de voz.

O exercicio de fala degrada em camadas, cada uma com uma mensagem propria em vez de
falhar em silencio:

1. **Sem `SpeechRecognition` no navegador** (Firefox, por exemplo): vira ouvir,
   repetir em voz alta e confirmar a repeticao.
2. **Fora de contexto seguro** (`isMicAllowedHere`): o navegador bloqueia a captura
   de microfone fora de HTTPS/localhost. Isso pega o caminho recomendado para testar
   no celular (`http://SEU_IP:5173`, veja "Abrindo no celular" no README raiz) — a
   API existe, o botao apareceria, mas a captura nunca comeca. Mesmo fallback do
   item 1.
3. **Permissao negada** (`not-allowed` / `service-not-allowed`): pede para liberar o
   microfone para o site.
4. **Nada foi captado** (`no-speech`, `aborted`, ou a escuta terminou sem
   `onresult`): pede para checar o microfone selecionado e falar mais perto.
5. **Falha de rede** (`network`, `audio-capture`): o motor de reconhecimento do
   Chrome/Edge depende de servidor, entao offline nunca devolve resultado.

Sem esse diagnostico por camada, qualquer um desses casos parecia a mesma coisa para
o aluno: "cliquei no microfone e nada aconteceu".

Na comparacao da resposta falada, a similaridade minima e 75%, nao exata: o
reconhecimento troca palavras parecidas e engole artigos, e exigir transcricao
perfeita mediria o microfone, nao o ingles.

## Nivel do usuario

`useLevel` guarda o nivel em `localStorage` (`piliplingo.level`). Enquanto nao houver
nivel escolhido, o app mostra o `LevelPicker` em tela cheia; depois o nivel aparece
como chip no header e pode ser trocado a qualquer momento. Como a API recebe o nivel
por parametro, migrar isso para um perfil no backend depois nao muda o contrato.

A aba **Estudar** consulta `GET /vocabulary/sentences/status` e, quando a IA nao esta
configurada, avisa que frases novas estao desligadas em vez de deixar o aluno achando
que o app parou de evoluir. A revisao dos cards existentes continua funcionando.

## Decisoes de UI para celular

- Layout em coluna com tab bar fixa; conteudo respeita `safe-area-inset` (notch).
- Areas de toque com no minimo 44px; inputs com `font-size: 16px` para o iOS nao
  dar zoom ao focar.
- Cadastro em bottom sheet, padrao familiar no mobile, fechavel por Esc/toque fora.
- Busca com debounce de 300ms e cancelamento da requisicao anterior.
- Dark theme por padrao, `prefers-reduced-motion` respeitado, sem scroll horizontal.
- A partir de 640px a lista vira duas colunas.

## PWA

`vite-plugin-pwa` gera manifest e service worker no build (`registerType: autoUpdate`).
Os icones em `public/icons` sao placeholders gerados proceduralmente: troque pelos
definitivos quando houver identidade visual.
