# 🗄️ Database Setup and Diagnostics

## ⚠️ IMPORTANTE: Problema Detectado

Las migraciones **003** y **004** estaban **vacías**. Esto significa que las siguientes tablas NO existen en tu base de datos:

### Tablas Faltantes:
- ❌ `user_profiles`
- ❌ `user_subscriptions`
- ❌ `sop_documents`
- ❌ `sop_state_assignments`
- ❌ `sop_org_assignments`
- ❌ `sop_history`

## 🔧 Solución: Ejecutar Migraciones

### Opción 1: Desde Render (Recomendado)

1. **Ve a tu dashboard de Render**: https://dashboard.render.com
2. **Selecciona tu servicio de backend** (app-spediak)
3. **Ve a la pestaña "Shell"**
4. **Ejecuta estos comandos**:

```bash
cd /opt/render/project/src/app-spediak/backend
node scripts/run-migrations.js
```

5. **Verás la salida** indicando qué migraciones se aplicaron
6. **Espera el mensaje**: `✅ Migrations completed!`

### Opción 2: Desde tu máquina local (Si funciona)

```bash
cd app-spediak/backend
node scripts/run-migrations.js
```

## 🏥 Verificar que Todo Funciona

Después de ejecutar las migraciones, ejecuta el diagnóstico:

### Desde Render Shell:
```bash
cd /opt/render/project/src/app-spediak/backend
node scripts/diagnose-database.js
```

### Desde local:
```bash
cd app-spediak/backend
node scripts/diagnose-database.js
```

## 📊 ¿Qué Verifica el Diagnóstico?

El script `diagnose-database.js` verifica:

✅ **Conexión a la base de datos**
✅ **Todas las tablas requeridas existen** (14 tablas)
✅ **Índices creados** para performance
✅ **Triggers configurados** para auto-actualización de timestamps
✅ **Foreign keys** correctas
✅ **Todos los usuarios tienen perfiles**
✅ **Todos los usuarios tienen subscripciones**
✅ **Datos de SOPs**
✅ **Datos de anuncios**
✅ **Distribución de planes de suscripción**

### Auto-Fix Incluido:

Si encuentra usuarios sin `user_profiles` o `user_subscriptions`, **automáticamente los crea** con:
- Estado por defecto: `NC`
- Plan: `free`
- Límite: 5 statements

## 🎯 Resultado Esperado

Después de ejecutar ambos scripts, deberías ver:

```
✅ ALL CHECKS PASSED!
🎉 Database is healthy and fully operational!
```

## 📋 Tablas que Deben Existir

1. `users` - Usuarios principales
2. `inspections` - Historial de inspecciones
3. `prompts` - Prompts del sistema
4. `prompt_versions` - Versiones de prompts
5. `prompt_edit_locks` - Locks de edición
6. `knowledge_base` - Base de conocimiento
7. **`user_profiles`** ⭐ (NUEVA)
8. **`user_subscriptions`** ⭐ (NUEVA)
9. **`sop_documents`** ⭐ (NUEVA)
10. **`sop_state_assignments`** ⭐ (NUEVA)
11. **`sop_org_assignments`** ⭐ (NUEVA)
12. **`sop_history`** ⭐ (NUEVA)
13. `ad_inventory` - Inventario de anuncios
14. `admin_audit_log` - Log de auditoría
15. `discord_connections` - Conexiones Discord

## 🚨 Si Algo Sale Mal

1. **Verifica las variables de entorno** en Render:
   - `DATABASE_URL` debe estar configurada

2. **Revisa los logs** en Render Dashboard

3. **Contacta** si el error persiste con:
   - Screenshot del error
   - Output del diagnóstico

## 🔄 Webhook Actualizado

El webhook de Clerk ahora **automáticamente**:
- ✅ Crea `user_profiles` cuando se registra un usuario
- ✅ Crea `user_subscriptions` con plan 'free'
- ✅ Captura organización y nombre de compañía

## 📝 Notas

- Las migraciones son **idempotentes**: puedes ejecutarlas múltiples veces
- El diagnóstico **auto-repara** usuarios sin perfiles
- Todos los cambios están en Git y se desplegarán automáticamente

