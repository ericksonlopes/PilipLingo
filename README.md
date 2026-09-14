# PilipLingo

App para aprender ingles. Monorepo com backend FastAPI e frontend React mobile-first (PWA).

O app gira em volta de uma **sessao de estudo unica** que alterna entre os formatos
marcados pelo aluno (digitar, ouvir, ordenar e falar), sobre conteudo gerado por IA em
temas sorteados e calibrado pelo nivel CEFR do aluno. Cada frase vem com uma **analise
estrutural**: a frase quebrada em blocos, com o papel gramatical e o porque de cada um.
As revisoes seguem repeticao espacada.

## Stack

| Camada   | Tecnologia                                                                 |
| -------- | -------------------------------------------------------------------------- |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, SQLite, gerenciado com [uv](https://docs.astral.sh/uv/) |
| IA       | LangChain + Gemini (`langchain-google-genai`), saida estruturada           |
| Frontend | Node 24, Vite, React 19, TypeScript, React Router, vite-plugin-pwa          |
| Infra    | Docker Compose (backend + frontend)                                        |
| Qualidade| ruff, mypy (strict), pytest no backend; `tsc -b` no frontend                |

## Arquitetura

Backend em **hexagonal com fatias verticais**: cada modulo de negocio e autocontido e
so conversa com o mundo externo atraves de portas.

```
backend/src/
├── main.py              # composition root: cria o app FastAPI
├── orm_registry.py      # agrega o metadata das fatias para o Alembic
├── version.py
├── api/                 # router raiz versionado + healthcheck
├── shared/              # shared kernel: config, engine/sessao, erros, deps HTTP
└── modules/
    └── vocabulary/      # fatia vertical
        ├── domain/          # entidades, regras, PORTAS (sem framework/ORM)
        ├── application/     # casos de uso + DTOs (dependem so das portas)
        ├── infrastructure/  # ADAPTADORES: models SQLAlchemy, repositorio, mappers,
        │                    #              adaptador LangChain/Gemini
        └── api/             # ADAPTADOR de entrada: rotas, schemas, wiring das deps
```

A fatia `vocabulary` concentra o CRUD de termos **e** a geracao de frases por IA:
as duas capacidades giram em volta do mesmo agregado, o termo que o usuario esta
aprendendo.

Regra de dependencia: `api -> application -> domain` e `infrastructure -> domain`.
O dominio nao importa FastAPI, SQLAlchemy nem Pydantic.

Para criar uma nova fatia (ex.: `lessons`): replique as quatro pastas em
`src/modules/lessons/`, registre o router em `src/api/router.py` e os models em
`src/orm_registry.py`.

## Como a sessao de estudo funciona

Duas abas: **Estudar** e **Vocabulario**. Nao existe uma aba por tipo de exercicio.
Antes de comecar, o aluno marca um ou mais formatos; todos vem selecionados por padrao.
O backend monta a sessao e alterna cada exercicio apenas entre os formatos marcados.

| Modo | Como o aluno responde |
| ---- | --------------------- |
| `TYPING_CLOZE`      | digita a palavra que falta na frase |
| `AUDIO_DICTATION`   | ouve e monta a frase tocando em blocos de palavras |
| `BLOCK_TRANSLATION` | ve a frase em portugues e ordena os blocos em ingles |
| `VOCAB_MATCHING`    | liga ingles x portugues em duas colunas (4 a 5 cards) |
| `SPEAKING_PRACTICE` | ouve e repete em voz alta (reconhecimento no navegador) |

Depois de responder, qualquer modo oferece o botao **Entender estrutura**:

```
[I've been]           Present Perfect Continuous
                      acao que comecou no passado e continua acontecendo
[looking forward to]  Phrasal verb
                      aguardar algo com expectativa
[this moment.]        Direct object
                      o que esta sendo aguardado
```

Depois de responder, o app reproduz a frase e mostra **Continuar**. A nota e derivada
da correcao local: acerto envia `GOOD`; erro envia `AGAIN` e recoloca o exercicio no
fim da propria sessao. O switch **Avancar automaticamente** espera a fala terminar e
segue sozinho, mantendo o botao como alternativa imediata.

Detalhes de agendamento, contrato dos endpoints e o porque de cada decisao estao no
[README do backend](backend/README.md#sessao-de-estudo).

## Nivel do usuario e conteudo por IA

Na primeira abertura o app pergunta o nivel de ingles (A1 a C2). O nivel fica no
proprio aparelho (`localStorage`), porque ainda nao existem contas, e e enviado como
parametro para a API. Ele define:

- as frases geradas para a sessao (gramatica, tamanho e vocabulario por nivel)
- o nivel pre-selecionado ao cadastrar uma palavra nova

Para ligar a geracao, coloque a chave da [Gemini Developer API](https://aistudio.google.com/apikey)
em `.env` na raiz (veja `.env.example`):

```bash
PILIPLINGO_GOOGLE_API_KEY=sua-chave
```

Sem chave nada quebra: a sessao continua rodando com os cards que ja estao no banco e o
app avisa que frases novas estao desligadas. O 503 aparece so quando nao ha nada para
estudar.

> As rotas de IA ainda nao tem autenticacao nem rate limiting, e cada chamada consome
> tokens pagos da sua conta Google. A sessao de estudo gera frases automaticamente
> quando faltam cards, entao o gasto acontece sem clique explicito: o teto por
> requisicao (`PILIPLINGO_SENTENCES_MAX_PER_REQUEST`) e o unico freio hoje. Coloque
> auth e limite por usuario antes de expor a API na internet.

## Rodando com Docker (backend + frontend)

```bash
cp .env.example .env    # opcional, para a chave do Gemini
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/v1 (docs em http://localhost:8000/docs)
- As migrations rodam automaticamente no start do backend (`alembic upgrade head`).
- O SQLite vive no volume `backend-data`.

Build de producao do frontend (nginx na porta 8080):

```bash
docker compose --profile prod up --build frontend-prod
```

## Rodando local (sem Docker)

Backend:

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn main:app --app-dir src --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

O Vite encaminha `/api` para `http://localhost:8000`, entao nao ha CORS em dev.

## Abrindo no celular

O frontend e mobile-first e instalavel (PWA: manifest + service worker).

1. Descubra o IP da maquina na rede local (`ipconfig` no Windows).
2. Acesse `http://SEU_IP:5173` no celular (o dev server ja escuta em `0.0.0.0`).
3. Se o app chamar a API direto (sem proxy), inclua esse IP em
   `PILIPLINGO_CORS_ORIGINS`.
4. Para instalar: menu do navegador -> "Adicionar a tela inicial". O service worker
   e gerado no build (`npm run build && npm run preview`), nao no `npm run dev`.

## Qualidade

```bash
cd backend  && uv run ruff check src migrations && uv run mypy && uv run pytest
cd frontend && npm run build   # inclui tsc -b
```

## Skills do projeto (`.agents/`)

Instrucoes reutilizaveis de como implementar features neste repo, para agentes de
IA e para quem esta chegando:

| Skill                      | Quando usar                                          |
| -------------------------- | ---------------------------------------------------- |
| `feature-end-to-end`       | feature que atravessa backend e frontend             |
| `backend-vertical-slice`   | fatia/modulo novo no FastAPI                         |
| `backend-migration`        | tabela, coluna, indice ou drift de schema            |
| `backend-external-adapter` | integrar servico externo atras de uma porta          |
| `frontend-feature`         | tela, aba, hook ou consumo de endpoint novo          |

Detalhes e como carregar: [`.agents/README.md`](.agents/README.md).

## Estado atual

- Sessao de estudo alternando apenas entre os quatro formatos marcados pelo aluno
- Analise estrutural por blocos (`sentence_chunks`) em todo card, com o botao
  "Entender estrutura" disponivel nos cinco modos
- Repeticao espacada (SM-2 simplificado) com nota automatica: acerto envia `GOOD`;
  erro envia `AGAIN` e recoloca o card na propria sessao
- Geracao de conteudo por LangChain + Gemini em temas sorteados, calibrada pelo nivel,
  disparada automaticamente quando faltam cards vencidos
- Audio e reconhecimento de fala com API nativa do navegador, sem rota de TTS
- Fatia `vocabulary` completa: criar, listar com busca, detalhar, atualizar, remover
- Onboarding de nivel (A1 a C2) guardado no aparelho
- App mobile instalavel como PWA, com duas abas (Estudar e Vocabulario)
- Healthcheck com checagem de banco, erros de dominio mapeados para HTTP, migrations

Nao entrou ainda: autenticacao/JWT, rate limiting nas rotas de IA, persistencia do
nivel no backend (hoje e por aparelho), estatisticas de progresso e sequencia de dias,
e suite de testes automatizados (a verificacao hoje e manual, via `/docs` ou httpx).
