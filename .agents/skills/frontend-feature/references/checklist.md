# Checklist de feature no frontend

## Contrato com o backend

- [ ] Tipos em `lib/types.ts` batem campo a campo com o schema Pydantic
- [ ] Campos mantidos em `snake_case` como a API devolve
- [ ] Metodo adicionado no objeto de API correspondente em `lib/api.ts`
- [ ] Chamada cancelavel recebe `signal`
- [ ] Erro tratado via `ApiError` (usa `message`; usa `code`/`status` quando muda a UI)

## Estados da UI

- [ ] Carregando
- [ ] Vazio com texto que diz o proximo passo
- [ ] Erro com `role="alert"` e acao de tentar de novo
- [ ] Botao de acao desabilitado enquanto a requisicao esta em voo

## Mobile

- [ ] Toques com no minimo 44px (`var(--tap)`)
- [ ] Nenhum input abaixo de 16px
- [ ] Safe areas respeitadas em elementos fixos
- [ ] Sem scroll horizontal em telas de 320px de largura
- [ ] Texto do usuario com `overflow-wrap: anywhere`
- [ ] `enterKeyHint` / `autoCapitalize` / `spellCheck` coerentes com o campo

## Acessibilidade

- [ ] Botao so com icone tem `aria-label`
- [ ] SVG decorativo com `aria-hidden="true"` e `focusable="false"`
- [ ] Estado de selecao expresso por `aria-pressed` ou `aria-current`
- [ ] Foco visivel (nao remova o outline)

## Integracao

- [ ] `<Route>` registrada em `App.tsx`
- [ ] `TABS` do `AppShell.tsx` atualizado se for secao principal
- [ ] Classes novas em `global.css` usando os tokens existentes
- [ ] Feature que depende de config do backend consulta o status e degrada

## Qualidade

- [ ] `npm run build` passa (inclui `tsc -b`)
- [ ] Testado em viewport estreito (DevTools em 360x740)
- [ ] `frontend/README.md` atualizado se a estrutura mudou
