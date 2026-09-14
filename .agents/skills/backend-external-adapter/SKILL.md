---
name: backend-external-adapter
description: Integra um servico externo (LLM, API HTTP de terceiros, provedor de e-mail, TTS) no backend do PilipLingo atras de uma porta do dominio. Use ao adicionar integracao com Gemini/LangChain, dicionario externo, audio, tradutor ou qualquer dependencia de rede paga ou instavel.
metadata:
  author: PilipLingo
  version: 1.0.0
---

# Integrar servico externo atras de uma porta

Referencia canonica no projeto: a geracao de frases da fatia `vocabulary`
(LangChain + Gemini). Leia estes dois antes de comecar:
`modules/vocabulary/infrastructure/gemini_generator.py` e
`modules/vocabulary/infrastructure/chat_model.py`.

## Principio

O dominio declara **o que precisa**; o adaptador sabe **como**. Nenhum import da
SDK externa fora de `<slice>/infrastructure/`. Trocar de provedor deve ser escrever
outro adaptador, sem tocar em `domain/` nem `application/`.

```
domain/ports.py          ABC com o contrato em termos do dominio
infrastructure/<prov>.py  implementa a ABC usando a SDK
api/dependencies.py      escolhe a implementacao concreta
```

## Passo a passo

1. **Porta** em `<slice>/domain/ports.py`: ABC com metodos `async`, recebendo e
   devolvendo entidades/value objects do dominio. Sem tipo da SDK na assinatura.
2. **Erros** em `<slice>/domain/errors.py`, herdando de
   `shared.errors.UnavailableError` (mapeia para **503** automaticamente):
   - um erro de "nao configurado" (falta credencial)
   - um erro de "falhou" (provedor fora, resposta inutil, timeout)
3. **Config** em `shared/config.py`, prefixo `PILIPLINGO_`:
   - credencial **sempre** `SecretStr | None` (nao vaza em repr/log)
   - modelo/endpoint, `temperature`, timeout e retries configuraveis
   - uma property `is_<x>_configured` para a API expor status sem revelar segredo
   - limite de uso por requisicao quando a chamada custa dinheiro
4. **Factory do client** em `infrastructure/chat_model.py` (ou equivalente):
   levanta o erro de "nao configurado" se falta credencial e usa `@lru_cache`
   para reaproveitar conexoes entre requests.
5. **Adaptador**: implementa a porta.
   - Prefira **saida estruturada** (`with_structured_output` + schema Pydantic) a
     parsear texto livre.
   - Envolva a chamada em `try/except Exception` e converta em erro de dominio
     com `raise ... from cause`.
   - No log, **so o tipo da excecao**: nunca prompt, credencial ou dados do usuario.
   - Valide o retorno (vazio, campos em branco, itens acima do pedido) antes de
     montar as entidades.
6. **Wiring** em `<slice>/api/dependencies.py`: uma funcao por porta, devolvendo o
   tipo da **porta** (nao da implementacao), para o teste poder sobrescrever.
7. **Rota de status** (`GET /<slice>/status`) informando se a integracao esta
   ativa, o modelo/endpoint em uso e os limites — nunca a credencial. O frontend
   usa isso para degradar a UI.
8. **Documentar** em `.env.example` (raiz e `backend/`), no `docker-compose.yml`
   (`${VAR:-}`, jamais valor literal) e no `backend/README.md`.

## Seguranca e custo (obrigatorio)

- Credencial so por variavel de ambiente; `.env` fica fora do git.
- Se o endpoint gasta dinheiro por chamada, avise no README e no resumo ao
  usuario que a rota **nao tem auth nem rate limiting** enquanto isso for verdade,
  e mantenha um teto por requisicao.
- Deixe claro quais dados do usuario saem da maquina para o terceiro.
- Timeout sempre definido. Retries baixos (0 a 2).

## Como testar sem gastar nem depender da rede

Injete um fake pela dependencia da porta:

```python
class FakeGenerator(SentenceGenerator):
    async def generate(self, request): ...

app.dependency_overrides[get_sentence_generator] = lambda: FakeGenerator()
```

Cubra tres cenarios, todos verificaveis sem credencial valida:

1. sem credencial -> 503 com o `code` de "nao configurado"
2. com fake -> 200 e payload correto
3. com credencial invalida -> 503 com o `code` de "falhou" (nao 500)

## Comandos

```bash
cd backend
uv add "<pacote>>=<versao>"
uv run ruff check src && uv run mypy
```

Confirme a API real do pacote instalado por introspecao
(`uv run python -c "import x; print(dir(x))"`) em vez de confiar na memoria:
SDKs de IA mudam de nome de classe e de parametro com frequencia.
