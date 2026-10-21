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
semana, la comprobación diaria de la base de datos, despliegues) ni otros
servicios gratuitos que existan en la misma cuenta de Render. Por eso el margen
es amplio.

## Pendiente (requiere a quien administra la cuenta de Render)

La cuenta de Render es personal de quien la creó y un espacio de trabajo
gratuito no admite miembros (ADR-004), así que estos dos pasos solo los puede
hacer esa persona:

- [ ] Consulta del consumo real antes de fijar el horario: captura de Billing →
      Free Instance Hours con las horas consumidas en el mes.
- [ ] Medición tras una semana de funcionamiento: captura de la misma pantalla
      una semana después de activar el pinger, y comparación con la estimación.

| Fecha | Horas consumidas en el mes | Observaciones |
|---|---|---|
| _pendiente_ | _pendiente_ | _consumo real antes de activar el pinger_ |
| _pendiente_ | _pendiente_ | _consumo una semana después_ |

Si la medición supera las 600 horas proyectadas al mes, se reduce el horario o
se alarga el intervalo antes de que se agote el cupo: superarlo suspende los
servicios gratuitos hasta el mes siguiente.
