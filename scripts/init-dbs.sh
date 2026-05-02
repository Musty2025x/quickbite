#!/bin/bash
# scripts/init-dbs.sh — creates all service databases in one Postgres instance
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" << EOF
CREATE DATABASE users_db;
CREATE DATABASE restaurants_db;
CREATE DATABASE orders_db;
CREATE DATABASE delivery_db;
CREATE DATABASE notifications_db;
GRANT ALL PRIVILEGES ON DATABASE users_db         TO $POSTGRES_USER;
GRANT ALL PRIVILEGES ON DATABASE restaurants_db   TO $POSTGRES_USER;
GRANT ALL PRIVILEGES ON DATABASE orders_db        TO $POSTGRES_USER;
GRANT ALL PRIVILEGES ON DATABASE delivery_db      TO $POSTGRES_USER;
GRANT ALL PRIVILEGES ON DATABASE notifications_db TO $POSTGRES_USER;
EOF
echo "✅ All QuickBite databases created"
