# Frontend Feature Checklist

## Backend Contract

- [ ] Types in `lib/types.ts` match Pydantic schema field by field
- [ ] Preserved `snake_case` naming matching API responses
- [ ] Method added to corresponding API client object in `lib/api.ts`
- [ ] Abortable requests accept `signal` parameter
- [ ] Errors handled via `ApiError` (`message`, `code`, `status`)

## UI States

- [ ] Loading state
- [ ] Empty state with clear next-step instruction
- [ ] Error state with `role="alert"` and retry action
- [ ] Action buttons disabled during pending network requests

## Mobile Standards

- [ ] Touch targets minimum 44px (`var(--tap)`)
- [ ] No input font sizes below 16px
- [ ] Safe areas respected on fixed/sticky elements
- [ ] Zero horizontal overflow on 320px screen widths
- [ ] User-generated text handles long words (`overflow-wrap: anywhere`)
- [ ] Proper `enterKeyHint`, `autoCapitalize`, and `spellCheck` attributes per field

## Accessibility

- [ ] Icon-only buttons include `aria-label`
- [ ] Decorative SVGs include `aria-hidden="true"` and `focusable="false"`
- [ ] Selection state indicated by `aria-pressed` or `aria-current`
- [ ] Visible focus outlines maintained

## Integration

- [ ] `<Route>` registered in `App.tsx`
- [ ] `TABS` array in `AppShell.tsx` updated if adding a primary section
- [ ] New CSS classes added to `global.css` using existing design tokens
- [ ] Features with backend dependencies query status and degrade gracefully

## Quality Assurance

- [ ] `npm run build` succeeds cleanly (`tsc -b` + Vite build)
- [ ] Verified on mobile viewport dimensions (e.g. 360x740)
- [ ] `frontend/README.md` updated if directory structure or setup changed
