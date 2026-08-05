# Redmine Time Control

Motor de reglas de imputación de horas para Redmine, más un conjunto de personalizaciones de interfaz que lo acompañan. Implementado sin forkear Redmine ni escribir un plugin: un initializer que reabre las clases del core y scripts servidos por [View Customize](https://github.com/onozaty/redmine-view-customize).

En producción sobre Redmine 7.0.0 / Rails 7.2 / MySQL 8 en una consultora SAP, ~50 consultores imputando horas contra proyectos facturables.

*([English below](#english))*

---

## El problema

En una consultora que factura por horas, el parte de horas no es un dato blando: es la base de la facturación al cliente y del cálculo de rentabilidad por proyecto. Redmine, tal como viene, no impone ninguna restricción sobre él. Un consultor puede:

- imputar 40 horas en un solo registro;
- cargar horas la semana que viene sobre un mes ya cerrado y facturado;
- imputar 300 horas contra una petición estimada en 20;
- imputar en fechas fuera del periodo de vida de la petición;
- borrar registros propios y rehacer el historial.

Cada uno de esos casos rompe algo distinto río abajo: la factura ya emitida, el margen del proyecto, la trazabilidad de la auditoría. Este repositorio es el conjunto de reglas que se puso para cerrar cada uno de esos huecos.

## Las reglas

Todas las reglas eximen a los administradores, para que exista siempre una vía de corrección.

### 1. Techo por horas estimadas

Ninguna petición puede acumular más horas imputadas que sus `estimated_hours`. La validación suma lo ya imputado excluyendo el registro actual — de modo que editar un registro existente no se cuenta dos veces — y si el total proyectado excede lo estimado, rechaza el guardado informando el **saldo disponible**, no solo el error:

> `Horas:: Se excede el limite de horas estimadas de la peticion "#4821". Horas estimadas totales: "20.0h"; saldo de horas de la peticion: "3.5h"`

Devolver el saldo importa: sin él, el consultor prueba por tanteo hasta que el formulario deja de quejarse. Si la petición no tiene estimación, la regla no aplica.

### 2. Tope por registro

Máximo 9 horas en una sola imputación.

El tope es **por registro, no por jornada**: la validación mira únicamente el `hours` del registro que se está guardando, sin agregar por usuario ni por fecha. Varios registros del mismo día pueden sumar más de 9 horas entre todos, lo cual es intencional — la imputación de una jornada larga se parte en varias líneas, cada una contra su petición.

### 3. Las fechas deben caer dentro de la petición

`spent_on` debe estar entre `start_date` y `due_date` del issue. Solo se aplica si ambas fechas están cargadas, para no bloquear peticiones sin planificar.

### 4. Cierre de periodos contables

Esta es la regla central, y la que tiene el diseño menos obvio.

Un periodo se cierra cuando se factura. A partir de ahí, ninguna imputación nueva debería poder alterar el total de ese mes. Pero la definición de qué está cerrado cambia todos los meses, y quien la conoce es administración, no TI.

En vez de codificar el calendario o construir una pantalla de configuración, la regla **reutiliza un campo personalizado de Redmine como tabla de configuración**. El campo `V_PERIODOS` (tipo lista) se interpreta así:

| Parte del campo | Significado |
|---|---|
| `description` | días de gracia hacia atrás (entero). Si no es un entero, se usa el default de 2 |
| `possible_values` | meses abiertos en formato `YYYYMM`. Los valores que no matcheen `\d{6}` se ignoran |

Así, cerrar un mes es editar un campo personalizado desde la interfaz de administración de Redmine — algo que administración puede hacer sin pedir un despliegue. El coste es un uso poco ortodoxo del modelo de datos; a cambio, la regla es operable por quien realmente sabe cuándo cerrar.

**Qué pasa al violarla, y por qué.** Un registro fuera de periodo no se rechaza: se guarda con `hours = 0.0` y con el comentario reescrito para dejar constancia.

```
Periodo cerrado al reportar "6.5" horas el "12/08/2026 09:41:33"|<comentario original>
```

La decisión de guardar en cero en lugar de rechazar es deliberada. Un rechazo deja cero evidencia de que alguien intentó imputar tarde: el consultor cierra el formulario y no queda nada. Guardar en cero preserva la intención declarada, el momento exacto del intento y el comentario original, sin tocar el total facturable del periodo cerrado. Lo que se pierde en limpieza del dato se gana en trazabilidad: el supervisor puede ver quién imputa sistemáticamente tarde, que es el comportamiento que en realidad se quiere corregir.

Al usuario se le informa vía flash desde un `after_action` del controlador, porque una validación exitosa no tiene forma de comunicar nada por sí sola.

### 5. Bloqueo de edición sobre periodos cerrados

Complemento de la anterior, en `on: :update`. Evalúa **dos** fechas: la original (`spent_on_was`) y la nueva. Bloquear solo una deja un agujero — con solo la nueva, se puede mover un registro fuera de un periodo cerrado; con solo la original, se puede mover uno abierto hacia adentro de uno cerrado. Ambas direcciones alteran totales ya facturados.

### 6. Sin borrado

`before_destroy` con `throw :abort` para todo el mundo salvo administradores. Un parte de horas del que se pueden borrar líneas no sirve como evidencia de nada. Corregir es imputar en negativo o pedir a un administrador, no hacer desaparecer.

El mensaje de error se propaga a la interfaz con un `after_action` sobre `destroy` que recorre tanto `@time_entries` (borrado masivo desde el menú contextual) como `@time_entry` (borrado individual) y muestra los que no se destruyeron. Sin eso, Redmine falla en silencio y el usuario cree que borró.

### 7. Horas estimadas restringidas por grupo

Las reglas 1 y 4 se apoyan en `estimated_hours`, así que si cualquiera puede editarlo, el techo es decorativo. Solo los miembros del grupo `ARM_TIME_ADMIN` pueden modificarlo.

### 8. Dos ajustes de usabilidad

- **Ventana por defecto de 60 días** en la vista Tiempo Dedicado. El filtro por defecto de Redmine (`*`, todo) hace un full scan sobre cientos de miles de registros y tarda varios segundos en cargar.
- **Horas en decimal**, no `HH:MM`. `22.5` se copia a una planilla y se suma; `22:30` no.

## Configuración

Todo lo ajustable vive en un módulo al inicio del archivo:

```ruby
module TimeControl
  TIMEZONE                     = 'America/Asuncion'
  PERIODS_FIELD                = 'V_PERIODOS'
  DEFAULT_GRACE_DAYS           = 2
  MAX_HOURS_PER_ENTRY          = 9.0
  ESTIMATED_HOURS_ADMIN_GROUP  = 'ARM_TIME_ADMIN'
  DEFAULT_SPENT_ON_WINDOW_DAYS = 60
end
```

## Por qué un initializer y no un plugin

Un plugin de Redmine implica versionado, migraciones y compatibilidad a mantener contra cada release del core. Estas reglas no son funcionalidad reutilizable: son la política de una empresa, y cambian cuando cambia la política, no cuando cambia Redmine.

Un initializer dentro de `config.to_prepare` recarga correctamente en desarrollo, se aplica una sola vez en producción y se elimina borrando un archivo. Las clases se resuelven con `safe_constantize` en lugar de referencias directas para no forzar el autoload de Zeitwerk durante el arranque, y cada parche está envuelto en `unless method_defined?(...)` para que sea idempotente si el bloque se evalúa más de una vez.

## Personalizaciones de interfaz

En [`view_customize/`](view_customize/) están los scripts que se cargan mediante el plugin View Customize. Cada archivo lleva en su cabecera el `path_pattern` y la posición de inserción que le corresponden.

Lo más sustancial es el **cronómetro por ticket** (`01`, `02`, `03`):

- Botón Iniciar/Detener en la barra contextual del issue; el instante de inicio se persiste en `localStorage`, así que sobrevive a recargas y a navegar fuera del ticket.
- Un badge en la barra superior muestra los cronómetros activos, actualizado cada segundo y enlazado de vuelta al issue — sin eso, es fácil dejar uno corriendo y olvidarlo.
- Al detenerlo, redirige al alta de imputación con las horas ya calculadas y el campo booleano `TimeTracker` premarcado, lo que permite después distinguir las horas medidas de las estimadas de memoria.
- Tope de 24 h y bloqueo de cronómetros simultáneos: si hay uno activo en otro ticket, avisa en vez de arrancar un segundo.
- Las claves se limpian al cerrar sesión, para que un equipo compartido no herede el cronómetro del turno anterior.

El resto son ajustes menores: redirigir la portada a Mi Página, premarcar "heredar miembros" al crear proyectos, aceptar `S` donde Redmine exige escribir `Sí`, y estilos sobre el tema base.

## Instalación

```bash
cp config/initializers/time_control_rules.rb /ruta/a/redmine/config/initializers/
```

Ajustar las constantes del módulo `TimeControl`, crear el campo personalizado de periodos y el grupo de administradores de horas, y reiniciar Redmine.

Para los scripts de interfaz hace falta el plugin [View Customize](https://github.com/onozaty/redmine-view-customize); cada archivo se pega en una entrada nueva usando el `path_pattern` y la posición indicados en su cabecera.

## Limitaciones conocidas

- Las reglas se aplican en la capa de modelo, así que también rigen para la API REST y para las importaciones — que es lo buscado, pero conviene tenerlo presente al cargar datos históricos. La vía es desactivar el initializer temporalmente o correr la carga como administrador.
- La regla 1 hace un `SUM` sobre `time_entries` por cada validación. Con volúmenes muy grandes por petición convendría cachear.
- Los scripts de interfaz dependen de la estructura del DOM de Redmine 7; una actualización mayor del core puede requerir ajustarlos.

## Licencia

GPL v2, la misma que Redmine. Ver [LICENSE](LICENSE).

---

<a name="english"></a>

# English

A time-entry rules engine for Redmine, built for an SAP consultancy where the timesheet drives client invoicing. Stock Redmine enforces nothing on time entries; this adds:

1. **Estimated-hours ceiling** — an issue can never accrue more logged hours than its estimate. The error returns the remaining balance, not just a rejection.
2. **9-hour cap per entry** — the ceiling applies per record, not per day. Nothing aggregates by user and date, so a long day is split across several entries, each against its own issue.
3. **Date range** — `spent_on` must fall within the issue's start/due dates.
4. **Accounting period lock** — the core rule. A Redmine custom field (`V_PERIODOS`) doubles as the configuration table: its `description` holds the grace period in days, its `possible_values` the open months as `YYYYMM`. Closing a month is editing a custom field in the admin UI — something finance can do without a deployment. Entries filed against a closed period are **saved with zero hours** rather than rejected, with the attempt recorded in the comment. Rejecting would leave no trace that someone tried to backdate; zeroing preserves the evidence without touching an invoiced total.
5. **Edit lock** on closed periods, checking both `spent_on_was` and the incoming date — guarding only one leaves a hole in either direction.
6. **No deletion** for non-admins, with the failure surfaced to the UI (Redmine otherwise fails silently on a vetoed `destroy`).
7. **Estimated hours restricted to a group** — rules 1 and 4 lean on `estimated_hours`, so an editable estimate makes the ceiling decorative.

Implemented as a `config.to_prepare` initializer rather than a plugin: these are one company's policies, not reusable functionality, and they change on a policy cycle rather than a Redmine release cycle. Classes resolve via `safe_constantize` to avoid forcing Zeitwerk autoload at boot, and every patch is guarded by `unless method_defined?` to stay idempotent.

[`view_customize/`](view_customize/) holds the accompanying front-end work, most notably a per-issue **stopwatch** with `localStorage` persistence, a live badge in the top bar, a 24-hour ceiling, single-timer enforcement across tickets, and hand-off into a prefilled time-entry form flagged with a `TimeTracker` custom field.

Licensed GPL v2.
