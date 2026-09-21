import { NextResponse } from 'next/server';
import { countUsers } from '@/lib/users';

export async function GET() {
  return NextResponse.json({ hasUsers: (await countUsers()) > 0 });
}
