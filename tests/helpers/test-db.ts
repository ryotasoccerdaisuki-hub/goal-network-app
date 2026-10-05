// tests/helpers/test-db.ts
//
// 統合テスト用の SQLite テスト DB セットアップ。
// prisma-client は .env を自動ロードしないため datasourceUrl を明示的に渡す。
// マイグレーション SQL（migration.sql）を直接適用してスキーマを構築する。
// 各テストはユニークな一時 DB ファイルを使い、終了時に破棄する。

import { PrismaClient } from '../../src/generated/prisma/client'
import { randomUUID } from 'node:crypto'
import { readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// migration.sql のパス（プロジェクトルート基準）
const MIGRATION_SQL = resolve(
  __dirname,
  '../../prisma/migrations/20261004140806_init/migration.sql'
)

export interface TestDb {
  prisma: PrismaClient
  cleanup: () => Promise<void>
}

export async function createTestDb(): Promise<TestDb> {
  const dbFile = join(tmpdir(), `gna-test-${randomUUID()}.db`)
  const url = `file:${dbFile}`

  const prisma = new PrismaClient({ datasourceUrl: url })

  // migration.sql を適用する。
  // 各 SQL 文は "-- CreateTable" のようなコメント行で始まるため、
  // まずコメント行を除去してから ";" で分割し、1 文ずつ個別に実行する。
  const sql = readFileSync(MIGRATION_SQL, 'utf-8')
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')

  const statements = withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  // SQLite の外部キー制約を有効化してから各文を個別に適用する
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;')
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt)
  }

  const cleanup = async () => {
    await prisma.$disconnect()
    for (const f of [dbFile, `${dbFile}-journal`]) {
      if (existsSync(f)) {
        try {
          rmSync(f)
        } catch {
          // 削除失敗は無視する
        }
      }
    }
  }

  return { prisma, cleanup }
}
