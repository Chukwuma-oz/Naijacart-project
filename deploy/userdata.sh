#!/bin/bash
# EC2 user data for NaijaCart API (Amazon Linux 2023) — Session 8/37 pattern.
# Use this in your Launch Template. It installs Node.js, pulls the backend
# from your artifact bucket, and runs it as a systemd service.
#
# PREREQUISITES
#  - Instance role allows: s3:GetObject on the artifact bucket,
#    secretsmanager:GetSecretValue on the DB secret.
#  - Replace the two placeholders below.
set -euxo pipefail

ARTIFACT_S3="s3://REPLACE-your-artifact-bucket/naijacart-backend.zip"
DB_SECRET_ARN="REPLACE-arn:aws:secretsmanager:...:secret:naijacart-db"

dnf install -y nodejs unzip
mkdir -p /opt/naijacart
aws s3 cp "$ARTIFACT_S3" /tmp/naijacart-backend.zip
unzip -o /tmp/naijacart-backend.zip -d /opt/naijacart
cd /opt/naijacart
npm install --omit=dev

cat > /etc/systemd/system/naijacart.service <<UNIT
[Unit]
Description=NaijaCart API
After=network.target

[Service]
WorkingDirectory=/opt/naijacart
Environment=PORT=8080
Environment=DB_SECRET_ARN=${DB_SECRET_ARN}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
User=ec2-user

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now naijacart
