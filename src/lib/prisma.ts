import path from 'node:path'
import { PrismaClient } from '../generated/prisma/client'

// prisma-client は .env を自動ロードせず、DATABASE_URL=file:./dev.db の相対パスは
// 実行時の作業ディレクトリ（Next.js のビルド先など）を基準に解決されてしまう。
// そのため OS やビルド先に依存しないよう、プロジェクト直下の prisma/dev.db を指す
// 絶対パスを明示的に組み立てて datasourceUrl として渡す。
// process.cwd() はプロジェクトルート（package.json のある場所）を指す。
function resolveDatabaseUrl(): string {
  const absolutePath = path.resolve(process.cwd(), 'prisma', 'dev.db')
  // Windows のバックスラッシュを Prisma / SQLite が扱えるスラッシュ区切りに正規化する
  const normalized = absolutePath.split(path.sep).join('/')
  return `file:${normalized}`
}

// Next.js の開発時ホットリロードで PrismaClient が複数インスタンス化されないようにグローバルキャッシュを使う
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
