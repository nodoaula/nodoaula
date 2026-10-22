# Mantener la plataforma despierta en horario de uso (HU407)

Render suspende el servicio gratuito del backend a los quince minutos sin
tráfico y arrancarlo tarda unos 180 segundos (medido el 9 de octubre de 2026).
Para que la espera no ocurra mientras hay gente usando la plataforma, un
servicio externo consulta la ruta de salud del backend a intervalos regulares,
solo dentro de un horario acotado.

Esto es distinto de `.github/workflows/keep-database-active.yml`, que corre una
vez al día y solo existe para que Supabase no pause la base de datos. Esa tarea
no se usa para este fin.

## Horario y frecuencia

| Dato | Valor |
|---|---|
| Servicio externo | cron-job.org (plan gratuito) |
| URL consultada | `https://nodoaula-backend.onrender.com/actuator/health/liveness` |
| Días | lunes a viernes |
| Horas | 7:00 a 21:00, hora de Bogotá (UTC-5; configurar la zona `America/Bogota`) |
| Frecuencia | cada 10 minutos |
| Método | GET, plazo de espera de 60 s |

Con 10 minutos entre consultas la instancia nunca llega a los quince minutos
de inactividad. La primera consulta de la mañana puede tardar hasta tres
minutos en despertar al backend: por eso el horario empieza a las 7:00 y no a
la hora a la que se espera el primer uso.

## Consumo estimado

El límite es de 750 horas al mes **por cuenta**, no por servicio (Render →
Billing → Free Instance Hours).

- Horas encendida al día: 14 (de 7:00 a 21:00), más hasta 15 minutos tras la
  última consulta.
- Días hábiles por mes: hasta 23.
- Estimación mensual: 23 × 14,25 ≈ 328 horas.
- Margen frente al límite: unas 420 horas. Las 744 horas de un mes con la
  instancia siempre despierta no dejan margen; este horario sí.

Esta cifra es una estimación del horario, no una medición. No incluye otras
causas de que la instancia se encienda fuera de horario (visitas de fin de
semana, la comprobación diaria de la base de datos, despliegues). Por eso el
margen es amplio.

## Consumo real antes de activar el pinger

Consultado en Render → Billing → Free Instance Hours el 22 de octubre de 2026
(captura enviada por quien administra la cuenta):

| Dato | Valor |
|---|---|
| Horas de instancia gratuita consumidas en el mes | 33,33 de 750 (4,4 %) |
| Servicios en la cuenta | 2 de 25 (el sitio estático y el backend) |
| Minutos de construcción | 12 de 500 |
| Ancho de banda de salida | 23 MB de 5 GB |

Solo el backend consume horas de instancia: el sitio estático no. Con la cuenta
en 33,33 horas a 22 días del mes, el consumo sin pinger es de poco más de una
hora diaria, porque la instancia duerme casi todo el tiempo.

Proyección con el horario propuesto:

- Lo que queda de octubre (7 días hábiles, del 22 al 30): unas 100 horas, para
  un total de unas 133 horas.
- Un mes completo, como noviembre (21 días hábiles): 21 × 14,25 ≈ 300 horas.

Ambas quedan muy por debajo de las 750 horas, de modo que el horario no
necesita ajustes.

## Medición tras una semana (pendiente)

La cuenta de Render es personal de quien la creó y un espacio de trabajo
gratuito no admite miembros (ADR-004), así que la captura solo la puede enviar
esa persona.

- [x] Consulta del consumo real antes de fijar el horario (22 de octubre de
      2026).
- [ ] Medición tras una semana de funcionamiento: captura de la misma pantalla
      una semana después de activar el pinger, y comparación con la estimación.

| Fecha | Horas consumidas en el mes | Observaciones |
|---|---|---|
| 22 de octubre de 2026 | 33,33 de 750 | Antes de activar el pinger |
| _pendiente_ | _pendiente_ | Una semana después de activarlo |

Si la medición supera las 600 horas proyectadas al mes, se reduce el horario o
se alarga el intervalo antes de que se agote el cupo: superarlo suspende los
servicios gratuitos hasta el mes siguiente.
