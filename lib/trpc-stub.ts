/**
 * TRPC Stub Module
 *
 * This module provides a compatibility layer for the migration from tRPC to Supabase.
 * All backend API calls should be migrated to use Supabase directly.
 *
 * This is a temporary stub to prevent import errors during refactoring.
 * Remove this file once all tRPC calls have been migrated to Supabase.
 */

const createMutationStub = () => ({
  mutate: async (..._args: any[]) => {
    console.warn("tRPC stub: mutation called - migrate to Supabase");
  },
  mutateAsync: async (..._args: any[]) => {
    console.warn("tRPC stub: mutateAsync called - migrate to Supabase");
    return null;
  },
  isPending: false,
  isError: false,
  error: null,
  data: null,
});

const createQueryStub = (_params?: any) => ({
  data: null,
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: async () => {},
});

// useUtils stub — provides invalidate() no-ops for all known namespaces
const createUtilsStub = () => ({
  notifications: {
    getAll: {
      invalidate: async () => {},
      setData: () => {},
    },
  },
  payments: {
    status: {
      invalidate: async () => {},
    },
  },
  stats: {
    getDriverStats: {
      invalidate: async () => {},
    },
  },
});

export const trpc = {
  Provider: ({ children }: any) => children,
  useUtils: createUtilsStub,
  drivers: {
    register: {
      useMutation: createMutationStub,
    },
  },
  stats: {
    getDriverStats: {
      useQuery: createQueryStub,
    },
  },
  zones: {
    getZones: {
      useQuery: createQueryStub,
    },
  },
  collector: {
    getZoneDetails: {
      useQuery: createQueryStub,
    },
    getZoneHouseholds: {
      useQuery: createQueryStub,
    },
    getDocumentStatus: {
      useQuery: createQueryStub,
    },
  },
  households: {
    getHouseholds: {
      useQuery: createQueryStub,
    },
  },
  payments: {
    processPayment: {
      useMutation: createMutationStub,
    },
    initiate: {
      useMutation: createMutationStub,
    },
    status: {
      useQuery: createQueryStub,
    },
  },
  bookings: {
    getBookings: {
      useQuery: createQueryStub,
    },
    getBookingDetails: {
      useQuery: createQueryStub,
    },
  },
  documents: {
    getDocumentStatus: {
      useQuery: createQueryStub,
    },
  },
  // Notifications router — used by app/notifications.tsx and app/(tabs)/index.tsx
  notifications: {
    getAll: {
      useQuery: createQueryStub,
    },
    create: {
      useMutation: createMutationStub,
    },
    markRead: {
      useMutation: createMutationStub,
    },
    markAllRead: {
      useMutation: createMutationStub,
    },
  },
} as any;

export function createTRPCClient() {
  console.warn("createTRPCClient stub called - tRPC has been removed");
  return trpc;
}
