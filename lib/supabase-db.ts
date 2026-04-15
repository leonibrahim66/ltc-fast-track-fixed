import { supabase } from "./supabase";

/**
 * Generic query helper for Supabase
 */
export async function queryTable<T>(
  table: string,
  options?: {
    select?: string;
    filters?: Record<string, any>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
  }
) {
  let query = supabase.from(table).select<string, T>(options?.select || "*");

  // Apply filters
  if (options?.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
  }

  // Apply ordering
  if (options?.order) {
    query = query.order(options.order.column, {
      ascending: options.order.ascending !== false,
    });
  }

  // Apply pagination
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Insert record into table
 */
export async function insertRecord<T>(table: string, data: T) {
  const { data: result, error } = await supabase
    .from(table)
    .insert([data])
    .select();

  if (error) {
    throw error;
  }

  return result?.[0];
}

/**
 * Update record in table
 */
export async function updateRecord<T>(
  table: string,
  id: string | number,
  data: Partial<T>
) {
  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq("id", id)
    .select();

  if (error) {
    throw error;
  }

  return result?.[0];
}

/**
 * Delete record from table
 */
export async function deleteRecord(table: string, id: string | number) {
  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    throw error;
  }
}

/**
 * Get single record by ID
 */
export async function getRecord<T>(table: string, id: string | number) {
  const { data, error } = await supabase
    .from(table)
    .select<string, T>("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Subscribe to real-time changes
 */
export function subscribeToTable<T>(
  table: string,
  callback: (payload: any) => void,
  filter?: Record<string, any>
) {
  // Note: Real-time subscriptions require Supabase to be configured with realtime enabled
  // This is a placeholder implementation
  console.warn(`Real-time subscription to ${table} requested - configure Supabase realtime`);
  
  return () => {
    // Unsubscribe placeholder
  };
}

/**
 * Batch insert records
 */
export async function batchInsert<T>(table: string, records: T[]) {
  const { data, error } = await supabase
    .from(table)
    .insert(records)
    .select();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Batch update records
 */
export async function batchUpdate<T>(
  table: string,
  updates: Array<{ id: string | number; data: Partial<T> }>
) {
  const results = await Promise.all(
    updates.map(({ id, data }) => updateRecord(table, id, data))
  );

  return results;
}
