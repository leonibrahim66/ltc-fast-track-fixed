/**
 * Silent tRPC compatibility stub.
 * Keeps legacy imports alive while all logic runs through Supabase.
 * No startup warnings. No console noise.
 */

const createMutationStub = () => ({
  mutate: async (..._args: any[]) => {
    return null;
  },
  mutateAsync: async (..._args: any[]) => {
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
  refetch: async () => null,
});

const createUtilsStub = () => ({
  notifications: {
    getAll: {
      invalidate: async () => null,
      setData: () => null,
    },
  },
  payments: {
    status: {
      invalidate: async () => null,
    },
  },
  stats: {
    getDriverStats: {
      invalidate: async () => null,
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
  return trpc;
}