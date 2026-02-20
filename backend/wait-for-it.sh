#!/bin/bash
# wait-for-it.sh
# Script to wait for a service to become available.

set -e

TIMEOUT=15
WAITFORIT_CMD="nc -z"

while [ "$TIMEOUT" -gt 0 ]; do
    if $WAITFORIT_CMD $1; then
        exit 0
    fi
    sleep 1
    TIMEOUT=$((TIMEOUT - 1))
done

echo "Timeout waiting for $1"
exit 1
