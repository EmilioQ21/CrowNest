# ADR-010: npm audit y gitleaks como gates informativos

Estado: aceptada
Fecha: 2026-11-28

## Contexto
npm audit encuentra 3 vulnerabilidades altas o críticas en producción (body-parser, mongoose y proxy-addr) y gitleaks encuentra 3 secretos en el historial.

## Decisión
Los dos pasos corren en el pipeline con continue-on-error, así que informan pero no bloquean. Los demás gates (formato, ESLint, pruebas y cobertura) sí bloquean el merge.

## Consecuencias
- Si bloquearan hoy, ningún PR podría integrarse.
- Aparecen en cada PR como un error informativo.
- Cuando se corrijan las dependencias y las claves (H1) se quita continue-on-error y pasan a bloquear.
- Alternativa descartada: bloquear desde ya, como pide la historia de usuario US-07.
