# GitHub Actions -> AWS via OIDC (one-time setup)

Why OIDC: no AWS access keys stored in GitHub. Actions presents a short-lived
GitHub token; AWS verifies it and issues temporary credentials for ONE role,
scoped to ONE repo and branch. This is the least-privilege lesson (Sessions
6-7) applied to CI/CD (Session 30).

## Steps (Console)

1. **Create the identity provider** — IAM -> Identity providers -> Add
   provider -> OpenID Connect.
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience:     `sts.amazonaws.com`

2. **Create the deploy role** — IAM -> Roles -> Create role -> Web identity ->
   pick the provider above. After creation, replace the trust policy with
   `TrustPolicy` from `github-oidc-role.json` (edit org/repo/branch), and
   attach `PermissionsPolicy` as an inline policy (edit the placeholders).

3. **Add repository secrets** — GitHub repo -> Settings -> Secrets and
   variables -> Actions: `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`,
   `ARTIFACT_BUCKET`, `FRONTEND_BUCKET`, `CF_DISTRIBUTION_ID`, `ASG_NAME`
   (the last three come from the CloudFormation stack outputs).

4. **Push to main** — watch the two jobs run in the Actions tab, then confirm:
   the new artifact in S3, an instance refresh in the ASG, and the CloudFront
   invalidation.

## Order of operations for launch day

1. Create the artifact bucket (plain S3 bucket, any name).
2. Run the workflow ONCE (or upload a zip manually) so the artifact exists.
3. Deploy `deploy/naijacart-full.yaml` with `ArtifactBucket=<that bucket>`.
4. Import `database/schema.sql` + `seed.sql` into RDS (CloudShell/SSM).
5. Put the stack outputs into GitHub secrets; edit `frontend/config.js`
   API_BASE to the `ApiUrl` output; set `CORS_ORIGIN` to the
   `CloudFrontDomain` output (add it to `aws.env` via the launch template or
   a stack update); push to main — the pipeline does the rest, now and for
   every future release.
