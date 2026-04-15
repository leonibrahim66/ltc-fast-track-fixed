import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

const API_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket-launch',
    content: `# Getting Started with LTC Fast Track API

## Authentication
All API requests require an API key in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Base URL
\`\`\`
https://api.ltcfasttrack.com/v1
\`\`\`

## Rate Limiting
API keys have rate limits applied. Check the X-RateLimit headers in responses.`,
  },
  {
    id: 'endpoints',
    title: 'API Endpoints',
    icon: 'api',
    content: `# Available Endpoints

## Pickups
- GET /pickups - List all pickups
- POST /pickups - Create a new pickup
- GET /pickups/:id - Get pickup details
- PUT /pickups/:id - Update pickup
- DELETE /pickups/:id - Cancel pickup

## Users
- GET /users - List users
- GET /users/:id - Get user details
- PUT /users/:id - Update user

## Payments
- GET /payments - List payments
- POST /payments - Create payment
- GET /payments/:id - Get payment details

## Disputes
- GET /disputes - List disputes
- POST /disputes - File a dispute
- GET /disputes/:id - Get dispute details`,
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: 'webhook',
    content: `# Webhook Events

Webhooks allow you to receive real-time notifications for events.

## Event Types
- pickup.created
- pickup.completed
- payment.processed
- dispute.filed
- subscription.activated
- subscription.cancelled

## Webhook Payload
\`\`\`json
{
  "event": "pickup.created",
  "timestamp": "2026-01-08T06:30:00Z",
  "data": {
    "id": "p-123",
    "customerId": "c-456",
    "address": "123 Main St"
  }
}
\`\`\``,
  },
  {
    id: 'examples',
    title: 'Code Examples',
    icon: 'code',
    content: `# Code Examples

## JavaScript
\`\`\`javascript
const axios = require('axios');

const response = await axios.get('https://api.ltcfasttrack.com/v1/pickups', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
\`\`\`

## Python
\`\`\`python
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY'
}

response = requests.get('https://api.ltcfasttrack.com/v1/pickups', headers=headers)
\`\`\`

## cURL
\`\`\`bash
curl -X GET https://api.ltcfasttrack.com/v1/pickups \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\``,
  },
  {
    id: 'errors',
    title: 'Error Handling',
    icon: 'error',
    content: `# Error Responses

## Error Format
\`\`\`json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request was invalid",
    "details": "Missing required field: address"
  }
}
\`\`\`

## Common Error Codes
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Rate Limit Exceeded
- 500: Internal Server Error`,
  },
];

export default function APIDocumentationScreen() {
  const colors = useColors();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const activeSection = selectedSection
    ? API_SECTIONS.find(s => s.id === selectedSection)
    : null;

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">API Documentation</Text>
        <View className="w-6" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {!selectedSection ? (
          <>
            <View className="bg-primary/10 rounded-lg p-4 mb-4">
              <Text className="text-lg font-bold text-primary mb-2">Welcome to LTC Fast Track API</Text>
              <Text className="text-sm text-foreground">
                Build integrations with LTC Fast Track using our RESTful API. Access pickups, users, payments, and more.
              </Text>
            </View>

            {API_SECTIONS.map((section) => (
              <TouchableOpacity
                key={section.id}
                onPress={() => setSelectedSection(section.id)}
                className="bg-surface border border-border rounded-lg p-4 flex-row items-center gap-4 active:opacity-70"
              >
                <View className="w-12 h-12 rounded-lg bg-primary/10 items-center justify-center">
                  <MaterialIcons name={section.icon as any} size={24} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">{section.title}</Text>
                  <Text className="text-xs text-muted mt-1">Tap to view documentation</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setSelectedSection(null)}
              className="flex-row items-center gap-2 mb-4 active:opacity-70"
            >
              <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
              <Text className="text-primary font-semibold">Back to Docs</Text>
            </TouchableOpacity>

            <View className="bg-primary/10 rounded-lg p-4 mb-4">
              <View className="flex-row items-center gap-3">
                <MaterialIcons name={activeSection?.icon as any} size={28} color={colors.primary} />
                <Text className="text-2xl font-bold text-foreground">{activeSection?.title}</Text>
              </View>
            </View>

            <View className="bg-surface border border-border rounded-lg p-4">
              <Text className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">
                {activeSection?.content}
              </Text>
            </View>

            <View className="bg-success/10 rounded-lg p-4 mt-4">
              <View className="flex-row items-start gap-3">
                <MaterialIcons name="check-circle" size={20} color={colors.success} />
                <View className="flex-1">
                  <Text className="font-bold text-success">Pro Tip</Text>
                  <Text className="text-xs text-foreground mt-1">
                    Use our API sandbox environment to test your integration before going live.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
