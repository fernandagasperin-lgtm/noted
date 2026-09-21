import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';

export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Sem ANTHROPIC_API_KEY. Copie o prompt e gere onde preferir.' },
      { status: 501 },
    );
  }

  const { prompt } = await req.json();
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt vazio' }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    // Streaming keeps a long generation from hitting the SDK's request timeout;
    // the result is still returned in one piece.
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'O modelo recusou esta solicitacao.' },
        { status: 422 },
      );
    }

    const output = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return NextResponse.json({ output, model: message.model });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'API key invalida.' }, { status: 401 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Limite de uso atingido. Tente de novo em instantes.' },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return NextResponse.json({ error: 'Falha de conexao com a API.' }, { status: 503 });
    }
    const detail = err instanceof Error ? err.message : 'erro desconhecido';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
