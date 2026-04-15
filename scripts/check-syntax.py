#!/usr/bin/env python3
import os

files = [
    "lib/admin-context.tsx",
    "lib/it-realtime-context.tsx",
    "lib/pickups-context.tsx",
    "lib/payments-context.tsx",
    "lib/disputes-context.tsx",
    "lib/withdrawals-context.tsx",
    "lib/subscription-approval-context.tsx",
    "lib/auth-context.tsx",
    "app/(tabs)/index.tsx",
    "app/(tabs)/pickups.tsx",
    "app/admin-disputes.tsx",
    "app/admin-payments.tsx",
    "app/admin-commission.tsx",
    "app/admin-live-feed.tsx",
    "app/admin-live-pickups.tsx",
    "app/admin-live-registrations.tsx",
]

root = "/home/ubuntu/ltc-fast-track"
errors = []

for f in files:
    path = os.path.join(root, f)
    if not os.path.exists(path):
        print(f"MISSING: {f}")
        continue
    src = open(path).read()
    opens = src.count("{") + src.count("(") + src.count("[")
    closes = src.count("}") + src.count(")") + src.count("]")
    diff = abs(opens - closes)
    if diff > 10:
        print(f"WARN brace mismatch ({opens} opens vs {closes} closes): {f}")
        errors.append(f)
    else:
        print(f"OK: {f}")

print(f"\n{len(errors)} files with potential issues, {len(files) - len(errors)} OK")
