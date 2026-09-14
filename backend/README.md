# PilipLingo - backend

FastAPI + SQLAlchemy async + Alembic, em arquitetura hexagonal com fatias verticais.
Dependencias e ambiente gerenciados por [uv](https://docs.astral.sh/uv/).

## Setup

```bash
uv sync
cp .env.example .env      # opcional: os defaults ja funcionam com SQLite local
uv run alembic upgrade head
uv run uvicorn main:app --app-dir src --reload
```

- API: http://localhost:8000/api/v1
- Docs: http://localhost:8000/docs

> Este projeto nao e empacotado (`[tool.uv] package = false`): `src/` e a raiz de
> imports. Por isso o uvicorn recebe `--app-dir src`, o pytest usa
> `pythonpath = ["src"]` e o Alembic usa `prepend_sys_path = %(here)s/src`.

## Layout

```
src/
├── main.py            # create_app(): CORS, error handlers, router
├── orm_registry.py    # metadata agregado (usado pelo Alembic)
├── api/               # router raiz + /health
├── shared/            # config, database, errors, dependencias HTTP
└── modules/<slice>/
    ├── domain/          # entidades + portas (abstracoes)
    ├── application/     # casos de uso + DTOs
    ├── infrastructure/  # models ORM, repositorio, mappers
    └── api/             # rotas, schemas Pydantic, wiring
```

## Migrations

```bash
uv run alembic revision --autogenerate -m "descricao"
uv run alembic upgrade head
uv run alembic downgrade -1
uv run alembic current
```

O `migrations/env.py` le a URL de `shared.config.Settings` e o metadata de
`orm_registry`, entao runtime e migrations nunca divergem. `render_as_batch` fica
ligado no SQLite (ALTER TABLE limitado).

## Configuracao

Variaveis com prefixo `PILIPLINGO_` (ver `.env.example`). As principais:

| Variavel                   | Default                                     |
| -------------------------- | ------------------------------------------- |
| `PILIPLINGO_DATABASE_URL`  | `sqlite+aiosqlite:///<backend>/data/piliplingo.db` |
| `PILIPLINGO_API_PREFIX`    | `/api/v1`                                   |
| `PILIPLINGO_CORS_ORIGINS`  | `http://localhost:5173,http://127.0.0.1:5173` |
| `PILIPLINGO_DATABASE_ECHO` | `false`                                     |

## Qualidade

```bash
uv run ruff check src migrations
uv run ruff format src migrations
uv run mypy
uv run pytest
```

## Endpoints

| Metodo | Rota                          | Descricao                             |
| ------ | ----------------------------- | ------------------------------------- |
| GET    | `/api/v1/health`              | status da API e do banco              |
| POST   | `/api/v1/vocabulary`          | cadastra termo (409 se duplicado)     |
| GET    | `/api/v1/vocabulary`          | lista com `search`, `limit`, `offset` |
| GET    | `/api/v1/vocabulary/{id}`     | detalha                               |
| PATCH  | `/api/v1/vocabulary/{id}`     | atualiza parcialmente                 |
| DELETE | `/api/v1/vocabulary/{id}`     | remove (204)                          |
| GET    | `/api/v1/vocabulary/levels`   | niveis CEFR com rotulo                |
| GET    | `/api/v1/vocabulary/sentences/status`   | se a geracao por IA esta configurada |
| POST   | `/api/v1/vocabulary/sentences/generate` | gera frases no nivel informado (503 sem chave) |
| GET    | `/api/v1/vocabulary/study/options`      | modos e temas do menu de preparacao |
| GET    | `/api/v1/vocabulary/study/today`        | sessao nos modos individuais selecionados |
| POST   | `/api/v1/vocabulary/study/{id}/review`  | registra a revisao e reagenda o card (404 se nao existe) |

As rotas de caminho fixo (`/levels`, `/sentences/...`, `/study/...`) sao declaradas
**antes** de `/{entry_id}` em `routes.py`. Invertendo a ordem, o FastAPI tentaria
interpretar `levels` como UUID e responderia 422.

## Sessao de estudo

`GET /vocabulary/study/options` fornece ao app os quatro modos individuais
selecionaveis e o catalogo de temas com rotulos em portugues.
`GET /vocabulary/study/today?level=B1&modes=TYPING_CLOZE&modes=AUDIO_DICTATION`
devolve a sessao pronta; `theme` afeta somente frases novas e cada card recebe um dos
`modes` enviados. Repeticoes sao removidas preservando a ordem. Um unico modo fixa a
sessao naquele formato; lista vazia e `VOCAB_MATCHING` selecionado sao rejeitados.
A omissao de `modes` preserva a montagem legada, inclusive com `VOCAB_MATCHING` quando
ha cards suficientes.

```
1. cards vencidos do nivel (`due_at <= agora`, mais atrasados primeiro)
2. faltou para fechar o `limit`? gera frases novas por IA num tema sorteado
3. ainda faltou? adianta cards do nivel que nao venceram (`ahead_count`)
4. sorteia um modo por card e encaixa um exercicio de ligar pares
```

O gerador de IA entra na sessao como dependencia **opcional**
(`get_optional_sentence_generator`). Sem chave configurada a sessao ainda acontece com
os cards que ja estao no banco; o 503 aparece so quando nao ha absolutamente nada para
estudar. Uma dependencia externa nao derruba a tela principal do app.

`due_count` e `ahead_count` separam divida de revisao de estudo adiantado. Sem essa
distincao o preenchimento do passo 3 se passaria por revisao vencida e o numero de
"cards para revisar" mentiria.

### Os cinco modos

| Modo | O que vai no payload |
| ---- | -------------------- |
| `TYPING_CLOZE`      | `prompt` com `____` no lugar do termo, `answer` = a palavra |
| `AUDIO_DICTATION`   | `blocks` = palavras embaralhadas, `prompt` vazio (a pista e o audio) |
| `BLOCK_TRANSLATION` | `prompt` = frase em portugues, `blocks` = os chunks embaralhados |
| `VOCAB_MATCHING`    | `group` com 4 a 5 cards para ligar ingles x portugues |
| `SPEAKING_PRACTICE` | `answer` = a frase, validada por Speech Recognition no navegador |

O audio e o reconhecimento de fala rodam no cliente (API nativa do navegador), entao
nao ha rota de TTS nem upload de voz.

### Analise estrutural (`sentence_chunks`)

Cada card guarda a frase quebrada em blocos logicos, com o papel gramatical e uma
explicacao curta em portugues:

```json
[
  {"text": "I've been", "role": "Present Perfect Continuous",
   "explanation": "acao que comecou no passado e continua acontecendo"},
  {"text": "looking forward to", "role": "Phrasal verb",
   "explanation": "aguardar algo com expectativa"},
  {"text": "this moment.", "role": "Direct object",
   "explanation": "o que esta sendo aguardado"}
]
```

O adaptador **descarta** a analise quando os blocos nao reconstroem a frase original
(`_build_chunks` em `gemini_generator.py`). O motivo e concreto: esses mesmos blocos
sao as pecas do `BLOCK_TRANSLATION`, cuja resposta certa e a frase inteira. Se o
modelo inventasse, cortasse ou reordenasse palavras, o exercicio ficaria impossivel de
acertar. Sem analise o card continua estudavel, so nao oferece "Entender estrutura".

### Agendamento (SM-2 simplificado)

`StudyCard.register_review` em `domain/study.py`. Nota `AGAIN` zera o progresso, conta
um lapso, reduz o `ease_factor` e devolve o card com `interval_days = 0`, ou seja,
para a sessao atual e nao para o dia seguinte: o card errado tem que voltar antes de o
aluno fechar o app. `GOOD` segue 1 dia, 3 dias e depois `intervalo * ease_factor`;
`EASY` aumenta o `ease_factor` e afasta mais. O `ease_factor` fica preso entre 1.3 e
2.8 e o intervalo tem teto de 365 dias.

A nota vem do aluno, nao da correcao automatica: acertar chutando e diferente de
saber, e so ele sabe a diferenca.

## Geracao de frases (LangChain + Gemini)

Faz parte da fatia `vocabulary`: recebe o nivel CEFR e devolve frases com traducao.
Ja foi uma fatia `sentences` separada, mas as duas capacidades giram em volta do
mesmo agregado (o termo que o usuario esta aprendendo), e a fatia isolada existia so
para alcancar o vocabulario por uma porta `TermCatalog`. Com o merge, o caso de uso
le o repositorio direto e a porta intermediaria deixou de existir.

```
modules/vocabulary/
├── domain/
│   ├── entities.py   # VocabularyEntry + GeneratedSentence, SentenceRequest
│   ├── errors.py     # 404/409 do CRUD + 503: IA nao configurada / falha do provedor
│   └── ports.py      # VocabularyRepository, SentenceGenerator
├── application/      # CRUD + GenerateSentences (sorteia termos do proprio repositorio)
├── infrastructure/
│   ├── models.py / mappers.py / repository.py  # persistencia do vocabulario
│   ├── chat_model.py       # monta o ChatGoogleGenerativeAI a partir das Settings
│   └── gemini_generator.py # prompt + saida estruturada (LangChain)
└── api/
```

O dominio nao conhece LangChain: trocar Gemini por outro provedor significa escrever
um novo adaptador de `SentenceGenerator`. Nos testes, injete um fake pela dependencia
`get_sentence_generator` (`app.dependency_overrides`).

O nivel e calibrado por `shared/domain/proficiency.py`, que guarda para cada nivel as
restricoes de gramatica, tamanho de frase e vocabulario enviadas ao modelo.

Exemplo:

```bash
curl -X POST http://localhost:8000/api/v1/vocabulary/sentences/generate \
  -H "Content-Type: application/json" \
  -d '{"level":"B1","count":3,"topic":"entrevista de emprego","use_my_vocabulary":true}'
```

Quando `terms` vem vazio e `use_my_vocabulary` e `true`, o backend sorteia palavras do
vocabulario salvo, priorizando as do nivel informado.

### Atencao antes de expor publicamente

`POST /vocabulary/sentences/generate` **nao tem autenticacao nem rate limiting** e cada chamada
gasta tokens da sua conta Google. Hoje o unico freio e o teto de frases por requisicao
(`PILIPLINGO_SENTENCES_MAX_PER_REQUEST`). Antes de publicar, coloque autenticacao e
limite por usuario/IP. Os termos enviados saem da sua maquina para a API do Google.
