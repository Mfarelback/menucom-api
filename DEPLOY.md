# Documentación de Despliegue - MenuCom API

## Arquitectura

```
┌─────────────────────┐     ┌─────────────────────┐
│   Render           │ ──► │   Supabase         │
│   (Backend NestJS)  │     │   (PostgreSQL)     │
│   Puerto: 3001     │     │   Pooler: 5432    │
└─────────────────────┘     └─────────────────────┘
```

## Servicios Desplegados

### Base de Datos (Supabase)

| Campo         | Valor                                    |
| ------------- | ---------------------------------------- |
| URL           | https://krnwdkqmoeddifnemxdc.supabase.co |
| Puerto Pooler | 5432                                     |
| Database      | postgres                                 |

### Backend API (Render)

| Campo  | Valor                                    |
| ------ | ---------------------------------------- |
| ID     | `srv-d7e7js3eo5us73839gcg`               |
| Nombre | `menucom-api`                            |
| URL    | `https://menucom-api.onrender.com`       |
| Repo   | `Martin444/menucom-api` (branch: master) |

## Variables de Entorno

```
ENV=prod
NODE_ENV=production
POSTGRESQL_URL=postgresql://postgres:[PASSWORD]@db.krnwdkqmoeddifnemxdc.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=menucom-prod-secret-2024
```

## Comandos

```bash
# Ver logs
render_list_logs --resource srv-d7e7js3eo5us73839gcg --limit 50

# Métricas
render_get_metrics --resourceId srv-d7e7js3eo5us73839gcg --metricTypes ["cpu_usage", "memory_usage"]
```

## Endpoints

- `https://menucom-api.onrender.com/docs` - Swagger UI
- `https://menucom-api.onrender.com/` → redirect a `/docs`
