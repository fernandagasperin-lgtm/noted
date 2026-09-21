import { NextResponse } from 'next/server';
import { countUsers } from '@/lib/users';

export async function GET() {
  const hasUsers = (await countUsers()) > 0;
  return NextResponse.json({
    hasUsers,
    // Sem SETUP_CODE ninguem cria a primeira conta, nem que o banco esteja vazio.
    setupOpen: !hasUsers && Boolean(process.env.SETUP_CODE),
  });
}
