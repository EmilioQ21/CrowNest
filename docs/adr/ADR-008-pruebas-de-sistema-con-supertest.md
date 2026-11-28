# ADR-008: Pruebas de sistema con Supertest en lugar de Playwright

Estado: aceptada
Fecha: 2026-11-28

## Contexto
El plan pedía una suite de regresión con Playwright, con un flujo por requisito (RF-01 a RF-09).

## Decisión
Los recorridos se hacen sobre la API con Supertest y la base de datos en memoria, uno por requisito. Se decidió por el tiempo que lleva armar Playwright.

## Consecuencias
- Los 8 recorridos corren en menos de 3 segundos y se repiten en el pipeline.
- No cubren lo que se ve en pantalla, el acceso como invitado (RF-02) ni la búsqueda en TMDB (RF-03). Eso se revisa en la UAT.
- Alternativa descartada: Playwright contra el frontend.
