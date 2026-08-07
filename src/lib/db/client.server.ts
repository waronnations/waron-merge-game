/**
 * War On Nations — Neon Postgres client (server-only).
 * Low-level connection + tagged-template `sql` helper.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

function resolveDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

export function hasDatabase(): boolean {
  return Boolean(resolveDatabaseUrl());
}

type CompatResult = { rows: Record<string, unknown>[]; rowCount: number };

let _raw: NeonQueryFunction<false, false> | null = null;

function rawSql(): NeonQueryFunction<false, false> {
  if (_raw) return _raw;
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL not configured");
  _raw = neon(url);
  return _raw;
}

export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<CompatResult> {
  const client = rawSql();
  const rows = (await client(strings, ...values)) as Record<string, unknown>[];
  return { rows: rows ?? [], rowCount: rows?.length ?? 0 };
}

