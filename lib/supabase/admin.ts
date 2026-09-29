import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
} from "./rest";

/**
 * Compatibility shim for older Cano AI builds.
 *
 * The current Supabase integration uses server-side REST helpers and does not
 * require the @supabase/supabase-js package.
 *
 * This file intentionally avoids importing @supabase/supabase-js so an older
 * lib/supabase/admin.ts left in the repository cannot break the Vercel build.
 */
export function createSupabaseAdmin() {
  return {
    from(table: string) {
      return {
        select(params?: Record<string, string | number | boolean | null | undefined>) {
          return supabaseSelect(table, params);
        },
        insert(payload: Record<string, any> | Record<string, any>[]) {
          return supabaseInsert(table, payload);
        },
        upsert(
          payload: Record<string, any> | Record<string, any>[],
          options?: { onConflict?: string }
        ) {
          if (!options?.onConflict) {
            throw new Error(
              "Compatibility Supabase admin upsert requires options.onConflict"
            );
          }

          return supabaseUpsert(table, payload, options.onConflict);
        },
        update(filters: Record<string, string>, payload: Record<string, any>) {
          return supabaseUpdate(table, filters, payload);
        },
      };
    },
  };
}
