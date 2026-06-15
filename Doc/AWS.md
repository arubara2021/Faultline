```markdown
# Faultline — AWS Infrastructure Setup

## Overview

This document records the AWS infrastructure configuration for the Faultline
hackathon project. Keep this file private — it contains endpoint information
and configuration details.

---

## Architecture

```
Vercel Serverless Functions
  → RDS Proxy (connection multiplexing)
    → Aurora PostgreSQL Serverless v2
```

---

## Aurora PostgreSQL Cluster

| Setting               | Value                                               |
|-----------------------|-----------------------------------------------------|
| Cluster Name          | faultline-cluster                                   |
| Engine                | Aurora PostgreSQL 17                                |
| Cluster Type          | Serverless v2                                       |
| Min ACU               | 0.5 (1 GiB)                                        |
| Max ACU               | 2 (4 GiB)                                          |
| Database Name         | faultline                                           |
| Master Username       | admin                                               |
| Master Password       | (stored separately — do not commit to git)          |
| Storage               | Aurora Standard                                     |
| Encryption            | AWS owned KMS key (SSE-RDS)                         |
| Delete Protection     | Disabled                                            |
| Auto Minor Upgrade    | Enabled                                             |
| Backup Retention      | 7 days                                              |
| Performance Insights  | Enabled (7 day retention)                           |
| Enhanced Monitoring   | Enabled (60 second granularity)                     |
| Babelfish             | Disabled                                            |
| RDS Data API          | Disabled                                            |
| DB Parameter Group    | default.aurora-postgresql17                         |

### Writer Endpoint

```
faultline-cluster.cluster-xxxxxxxxxxxx.us-east-1.rds.amazonaws.com
```

### Port

```
5432
```

---

## RDS Proxy

| Setting               | Value                                               |
|-----------------------|-----------------------------------------------------|
| Proxy Name            | proxy-1781005503011-faultline-cluster               |
| Engine                | PostgreSQL                                          |
| Port                  | 5432                                                |
| Auth Method           | Secrets Manager (auto-created during proxy setup)   |

### Proxy Endpoint (Use This for App Connections)

```
proxy-1781005503011-faultline-cluster.proxy-c2p28me4gw3b.us-east-1.rds.amazonaws.com
```

### Read-Only Endpoint (Not Used)

```
proxy-1781005503011-faultline-cluster-read-only.endpoint.proxy-c2p28me4gw3b.us-east-1.rds.amazonaws.com
```

---

## Security Group

| Setting               | Value                                               |
|-----------------------|-----------------------------------------------------|
| Security Group ID     | sg-0d0c859b48d47f1d0                                |
| Used By               | Aurora Cluster + RDS Proxy (same group)             |

### Inbound Rules

| Type         | Protocol | Port | Source      | Description             |
|--------------|----------|------|-------------|-------------------------|
| All traffic  | All      | All  | sg-0d0c...  | Default VPC rule        |
| PostgreSQL   | TCP      | 5432 | 0.0.0.0/0   | Allow Vercel to connect |

### Why 0.0.0.0/0

Vercel serverless functions connect from dynamic IPs. There is no single
IP or small CIDR range to whitelist. The database is protected by the
master username/password. For production, use Vercel's static IP ranges
(available on Pro/Enterprise plans).

---

## Connection String

```
postgresql://admin:YOUR_PASSWORD@proxy-1781005503011-faultline-cluster.proxy-c2p28me4gw3b.us-east-1.rds.amazonaws.com:5432/faultline
```

Replace `YOUR_PASSWORD` with the master password set during cluster creation.

**Important:** Always connect through the RDS Proxy endpoint, not the
Aurora cluster endpoint directly. The proxy handles connection multiplexing
from Vercel's stateless serverless functions.

---

## Environment Variables

### .env.local (local development)

```
DATABASE_URL=postgresql://admin:YOUR_PASSWORD@proxy-1781005503011-faultline-cluster.proxy-c2p28me4gw3b.us-east-1.rds.amazonaws.com:5432/faultline
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=true
```

### Vercel Environment Variables (production)

```
DATABASE_URL=postgresql://admin:YOUR_PASSWORD@proxy-1781005503011-faultline-cluster.proxy-c2p28me4gw3b.us-east-1.rds.amazonaws.com:5432/faultline
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
NEXT_PUBLIC_DEMO_MODE=true
```

---

## Estimated Monthly Cost

| Component                       | Cost              |
|---------------------------------|-------------------|
| Aurora Serverless v2 (0.5 ACU)  | ~$43-60/month     |
| RDS Proxy                       | ~$12-20/month     |
| Storage                         | Minimal           |
| I/O (Aurora Standard)           | $0.20 per 1M I/O  |
| Secrets Manager (auto-created)  | ~$0.40/month      |
| **Total estimate**              | **~$60-85/month** |

With $200 in hackathon credits, this covers 2-3 months of development
and demo time.

---

## Cost Saving Tips

- Minimum ACU at 0.5 scales to near-zero during idle periods
- Pause after inactivity (5 min) saves ACU compute when not querying
- Delete the cluster after the hackathon to stop all charges
- Monitor usage in AWS Cost Explorer

---

## How to Connect Locally

Install psql or any PostgreSQL client:

```bash
psql "postgresql://admin:YOUR_PASSWORD@proxy-1781005503011-faultline-cluster.proxy-c2p28me4gw3b.us-east-1.rds.amazonaws.com:5432/faultline"
```

Test query:

```sql
SELECT current_database();
-- Should return: faultline
```

---

## How to Delete Everything After the Hackathon

1. Go to RDS → Proxies → Select proxy → Delete
2. Go to RDS → Databases → Select cluster → Delete
   - Uncheck "Create final snapshot" if you don't need one
   - Type "delete me" to confirm
3. Go to Secrets Manager → Delete the auto-created secret
4. Go to EC2 → Security Groups → Delete sg-0d0c859b48d47f1d0
   (only after Aurora and Proxy are deleted)

---

## Troubleshooting

**Connection timeout:**
- Check security group has inbound rule for port 5432 from 0.0.0.0/0
- Make sure you're using the Proxy endpoint, not the Aurora endpoint
- Make sure public access is set to "Yes" on the Aurora cluster

**FATAL: too many clients already:**
- RDS Proxy should handle this, but check that your pg Pool max is set to 5
- Make sure the pool is instantiated at module level, not inside request handlers

**Password authentication failed:**
- Verify the password in the connection string matches the master password
- Check for special characters that need URL encoding
  (@ → %40, # → %23, ! → %21, etc.)

**SSL errors:**
- Add ?sslmode=require to the connection string if needed
- Or set ssl: { rejectUnauthorized: false } in pg Pool config
```