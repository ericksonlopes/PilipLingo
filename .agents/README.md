# .agents

Skills do projeto: instrucoes reutilizaveis que descrevem **como** implementar
features neste repositorio, para agentes de IA e para gente nova no time.

```
.agents/skills/
├── feature-end-to-end/        # orquestra: feature completa, back + front
├── backend-vertical-slice/    # nova fatia hexagonal no FastAPI
├── backend-migration/         # Alembic + SQLite (batch mode, autogenerate)
├── backend-external-adapter/  # servico externo atras de uma porta (ex.: Gemini)
└── frontend-feature/          # tela/aba/hook no app mobile-first
```

Cada skill e uma pasta com `SKILL.md` (frontmatter `name` + `description`) e,
quando faz sentido, `references/` com checklist detalhado.

## Como o Kiro carrega isso

O Kiro descobre skills automaticamente apenas em `.kiro/skills/` e
`~/.kiro/skills/`. Como as skills deste projeto ficam em `.agents/skills/`, elas
sao carregadas pelo agente customizado `.kiro/agents/piliplingo.json`, que
declara:

```json
"resources": ["skill://.agents/skills/*/SKILL.md"]
```

Ou seja: **selecione o agente `piliplingo`** na sessao para essas skills valerem.
No agente padrao elas nao sao descobertas automaticamente.

Alternativa, se preferir que valham em qualquer sessao: mova as pastas para
`.kiro/skills/` (ou copie), que e o caminho de descoberta padrao.

## Convencao ao escrever uma skill nova

- `name` igual ao nome da pasta, minusculas e hifens.
- `description` diz **quando** usar, com as palavras que a pessoa usaria no pedido.
- Corpo curto e acionavel: ordem de trabalho, comandos reais, armadilhas do repo.
- Detalhe longo vai para `references/`, carregado so quando necessario.
- Aponte para o codigo existente que serve de referencia em vez de duplicar
  template, para nao envelhecer.
