# ADR-009: SonarQube Community en local con Docker

Estado: aceptada
Fecha: 2026-11-28

## Contexto
El plan pide medir los code smells con SonarQube o SonarCloud (calificación A y menos de 5 % de deuda técnica).

## Decisión
Se corre SonarQube Community en la computadora con Docker y se analizan backend y frontend con sonar-scanner. Se eligió la opción que no depende de permisos sobre el repositorio.

## Consecuencias
- Se obtienen calificaciones, deuda técnica, bugs y vulnerabilidades sin pedir permisos.
- El análisis es manual: no corre en cada PR y no está en el pipeline.
- El quality gate por defecto evalúa el código nuevo, así que el primer análisis no basta para juzgar el código.
- Alternativa descartada: SonarCloud dentro del pipeline.
