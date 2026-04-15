# PawaPay API Notes

## Base URLs
- Sandbox: https://api.sandbox.pawapay.io
- Production: https://api.pawapay.io

## Auth
- Header: `Authorization: Bearer <PAWAPAY_API_KEY>`

## Deposit Endpoint
POST /v2/deposits

### Request Body
```json
{
  "depositId": "<UUIDv4>",
  "payer": {
    "type": "MMO",
    "accountDetails": {
      "phoneNumber": "260763456789",
      "provider": "MTN_MOMO_ZMB"
    }
  },
  "amount": "15",
  "currency": "ZMW",
  "clientReferenceId": "INV-123456",
  "customerMessage": "LTC Fast Track"
}
```

### Response (200)
```json
{
  "depositId": "...",
  "status": "ACCEPTED | REJECTED | DUPLICATE_IGNORED",
  "created": "2020-10-19T11:17:01Z"
}
```

## Zambia Network Correspondents
- MTN: MTN_MOMO_ZMB  (prefixes: 096, 076)
- Airtel: AIRTEL_OAPI_ZMB  (prefixes: 097, 077)
- Zamtel: ZAMTEL_ZMB  (prefixes: 095, 075)

## Callback Payload (from PawaPay to our server)
```json
{
  "depositId": "...",
  "status": "COMPLETED | FAILED",
  "amount": "15",
  "currency": "ZMW",
  "payer": { ... },
  "created": "...",
  "depositedAt": "..."
}
```
