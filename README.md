# NaijaCart — Capstone Codebase

A small but real e-commerce application used as the **common codebase for the
AWS Cloud Computing Course capstone**. Every team deploys this same app; your
grade comes from *how well you architect and operate it on AWS*, not from
writing application code.

**Stack:** vanilla JS frontend (no build step) · Node.js 20 / Express REST API ·
MySQL 8 (RDS-ready) · **ElastiCache Redis caching (cache-aside)** · JWT auth ·
Secrets Manager integration · Dockerfile · **full CloudFormation launch stack** ·
**GitHub Actions CI/CD (OIDC)**.

> **v2 — Board Directive edition.** The board has approved launch in one week.
> This repo is the base code; your team delivers the five launch deliverables
> in `Capstone_Brief_v2` (networking diagram, resources diagram, the
> CloudFormation deploy, the GitHub Actions pipeline, and the working
> end-to-end app with caching).

---

## Repository layout

```
naijacart/
├── backend/                 # Express REST API
│   ├── server.js            # entry point; /health for ALB checks
│   ├── db.js                # MySQL pool; Secrets Manager OR .env config
│   ├── cache.js             # cache-aside: ElastiCache Redis or in-memory fallback
│   ├── routes/              # products, orders (transactional), auth
│   ├── middleware/auth.js   # JWT verify + sign
│   ├── .env.example         # local + AWS configuration reference
│   └── Dockerfile           # for ECS Fargate option
├── frontend/                # static site -> S3 + CloudFront
│   ├── index.html  styles.css  app.js
│   └── config.js            # <-- set API_BASE to your ALB URL when deploying
├── database/
│   ├── schema.sql           # run against RDS MySQL
│   └── seed.sql             # demo catalogue
├── .github/workflows/
│   └── deploy.yml           # Deliverable 4: CI/CD to AWS via OIDC
└── deploy/
    ├── naijacart-full.yaml  # Deliverable 3: FULL launch stack (cfn-lint clean)
    ├── naijacart-starter.yaml   # VPC-only skeleton (practice/manual path)
    ├── github-oidc-role.json    # trust + permissions for the deploy role
    ├── github-oidc-setup.md     # one-time OIDC setup walkthrough
    ├── userdata.sh          # standalone bootstrap (manual path)
    ├── buildspec.yml        # CodeBuild alternative to Actions
    └── iam-policy-examples.json # least-privilege examples
```

## Run locally (before touching AWS)

1. MySQL 8 running locally. Then:
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seed.sql
   ```
2. Backend:
   ```bash
   cd backend
   cp .env.example .env        # edit DB_* values
   npm install
   npm start                    # -> http://localhost:8080/health
   ```
3. Frontend: open `frontend/index.html` in a browser (or `python3 -m http.server`
   in `frontend/`). `config.js` already points at `http://localhost:8080`.

Smoke test: register a user, add items to the cart, checkout, view "My Orders".

## How the pieces map to AWS (the capstone)

| Codebase piece            | AWS home (course session)                                   |
|---------------------------|-------------------------------------------------------------|
| `frontend/*`              | S3 private bucket + CloudFront with OAC (S13-14, S18)       |
| `frontend/config.js`      | Edit `API_BASE` -> your ALB DNS, re-upload, invalidate CDN  |
| `backend/*`               | EC2 Auto Scaling group behind ALB (S8-9) *or* ECS Fargate (S22) *or* Elastic Beanstalk (S24) |
| `backend/db.js`           | Reads credentials from **Secrets Manager** via `DB_SECRET_ARN` (S26) — instance/task role needs `secretsmanager:GetSecretValue` |
| `/health` endpoint        | ALB Target Group health check path                          |
| `database/schema.sql`     | RDS **MySQL** Multi-AZ in private subnets (S19); import via a bastion-less path: CloudShell/SSM or a temporary client instance |
| `CORS_ORIGIN` env var     | Set to your CloudFront domain once frontend is live         |
| `backend/cache.js`        | **ElastiCache Redis** via `REDIS_URL` (S21) — catalogue cached 60s, invalidated on order; check the `X-Cache: HIT/MISS` response header |
| `.github/workflows/deploy.yml` | **GitHub Actions -> AWS** via OIDC: artifact to S3, ASG instance refresh, frontend sync + CloudFront invalidation |
| `deploy/naijacart-full.yaml`   | One-command provisioning of the entire stack (VPC->CloudFront) |
| `deploy/userdata.sh`      | Launch Template user data (S8, S37)                         |
| `backend/Dockerfile`      | ECR + ECS Fargate option (S22)                              |
| `deploy/buildspec.yml`    | CodePipeline/CodeBuild bonus (S30)                          |
| `deploy/naijacart-starter.yaml` | CloudFormation starting point (S28) — extend it       |

## Deployment order (matches Session 37's checklist)

1. **Network** — deploy `naijacart-starter.yaml` (VPC, subnets) or build manually.
2. **Security** — SGs (ALB->app:8080, app->DB:3306 only), IAM roles from
   `iam-policy-examples.json`, create the DB secret in Secrets Manager.
3. **Data** — RDS MySQL Multi-AZ (private subnets); import `schema.sql` + `seed.sql`.
4. **Compute** — Launch Template with `userdata.sh` + ASG (min 2, two AZs) + ALB,
   health check `/health`; or the Docker/ECS path.
5. **Edge** — upload `frontend/` to the S3 bucket; CloudFront + OAC; update
   `config.js` with the ALB URL; set `CORS_ORIGIN` on the backend to the
   CloudFront domain and restart.
6. **Observe & harden** — CloudWatch alarms/dashboards, CloudTrail, tags, Budget.
7. **Tear down after presenting** — ASG/ALB, RDS, NAT, CloudFront, buckets.

## Cost guardrails

Free-Tier-friendly if you use `t3.micro`/`db.t3.micro`, single NAT (or none —
the app only needs outbound for npm during bootstrap; consider baking an AMI),
and **delete everything after Session 38**. Set a Budget on day one.

## Known simplifications (talk about these in your presentation)

- Payments are simulated (orders are just `PLACED`), no email, no admin panel.
- JWT secret via env — in production, rotate via Secrets Manager.
- `FOR UPDATE` row locks handle stock; a real system might use a queue (SQS)
  for spikes — a great "future work" slide.
