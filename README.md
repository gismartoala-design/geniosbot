# GeniosBot Web

Sitio de cursos GeniosBot con checkout PayPhone, panel administrador protegido y despliegue Docker.

## Qué incluye

- Web pública con paquetes de estudio: 1, 2, 3, 6 y 12 meses.
- Checkout que crea órdenes en el backend.
- Integración PayPhone desde servidor para no exponer el token en el navegador.
- Pago con tarjeta de débito, crédito corriente o crédito diferido.
- Panel administrador en `/admin` con login seguro.
- Persistencia simple en `data/orders.json` o volumen Docker.
- Dockerfile y `docker-compose.yml` listos para producción.

## Desarrollo local

```bash
npm run dev
```

Abre `http://localhost:8080`.

En desarrollo, si no configuras `ADMIN_PASSWORD_HASH`, puedes entrar a `/admin` con:

- Usuario: `admin`
- Contraseña: `admin123`

No uses esas credenciales en producción.

## Configuración de producción

1. Copia el ejemplo:

```bash
cp .env.example .env
```

2. Genera un secreto largo para sesiones y ponlo en `SESSION_SECRET`.

3. Genera el hash de contraseña:

```bash
npm run hash-password "tu-contraseña-segura"
```

Pega el resultado en `ADMIN_PASSWORD_HASH`.

4. Configura PayPhone:

```env
BASE_URL=https://tudominio.com
PAYPHONE_TOKEN=token-real-de-payphone
PAYPHONE_STORE_ID=si-payphone-te-lo-entrega
PAYPHONE_API_URL=https://pay.payphonetodoesposible.com/api/Sale
PAYPHONE_DEFERRED_ENABLED=true
PAYPHONE_DEFERRED_INSTALLMENTS=3,6,9,12
PAYPHONE_CARD_TYPE_FIELD=cardType
PAYPHONE_CREDIT_PLAN_FIELD=creditPlan
PAYPHONE_INSTALLMENTS_FIELD=installments
```

El endpoint y los nombres de campos para crédito/diferido quedan en variables porque PayPhone puede entregar credenciales, rutas y parámetros distintos según comercio/ambiente. Cuando PayPhone confirme los campos oficiales para tarjeta de crédito diferida, actualiza `PAYPHONE_CARD_TYPE_FIELD`, `PAYPHONE_CREDIT_PLAN_FIELD` y `PAYPHONE_INSTALLMENTS_FIELD` sin tocar código.

Importante: el sistema guarda la respuesta de PayPhone en la orden. No marca una orden como `paid` solo por volver desde una URL de éxito; ese cambio debe hacerse con confirmación real de PayPhone o desde el panel admin después de verificar el pago.

Nota de negocio: los meses del paquete son meses de estudio prepagados. Las cuotas de crédito diferido son cuotas bancarias para pagar ese total; no cambian la duración del curso.

## Docker

```bash
docker compose up -d --build
```

El volumen `geniosbot-data` conserva las órdenes creadas.

## Cloud Run

El contenedor escucha en `0.0.0.0` y usa la variable `PORT` que entrega Cloud Run. También expone:

```text
/healthz
```

Si no configuras `ADMIN_PASSWORD_HASH`, la web pública arranca igual, pero el panel `/admin` queda deshabilitado por seguridad. Para activar admin en Cloud Run, define como variables de entorno:

```env
SESSION_SECRET=un-secreto-real-de-minimo-32-caracteres
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=hash-generado-con-npm-run-hash-password
BASE_URL=https://tu-url-de-cloud-run-o-dominio.com
PAYPHONE_TOKEN=token-real-de-payphone
```

## Panel admin

Entra a:

```text
/admin
```

Desde ahí puedes ver órdenes, datos del representante, plan elegido, preferencia de horario, método de pago y cambiar estados.

## Archivos principales

- `server.js`: servidor, checkout, PayPhone, seguridad y admin.
- `index.html`, `styles.css`, `script.js`: web pública.
- `login.html`, `login.js`: acceso administrador.
- `admin.html`, `admin.js`: panel de órdenes.
- `Dockerfile`, `docker-compose.yml`: despliegue.
