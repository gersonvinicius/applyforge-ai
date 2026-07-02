import type { AiProviderConfig } from '@/domain/entities/types';

interface OpenRouterChatResult {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenRouterConnectionTestResult {
  ok: boolean;
  model: string;
  provider: string;
  contentPreview: string;
}

function extractJsonBlock(content: string): string {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    return content.slice(start, end + 1).trim();
  }

  return content.trim();
}

export async function runOpenRouterJsonPrompt(
  provider: AiProviderConfig,
  prompt: string
): Promise<OpenRouterChatResult> {
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'ApplyForge AI Local-First'
    },
    body: JSON.stringify({
      model: provider.defaultModel,
      temperature: provider.temperature,
      max_tokens: provider.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao chamar o provider: ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Provider retornou resposta vazia para a analise.');
  }

  return {
    content: extractJsonBlock(content),
    usage: payload?.usage
  };
}

export async function testOpenRouterConnection(
  provider: AiProviderConfig
): Promise<OpenRouterConnectionTestResult> {
  const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'ApplyForge AI Local-First'
    },
    body: JSON.stringify({
      model: provider.defaultModel,
      temperature: 0,
      max_tokens: 12,
      messages: [
        {
          role: 'user',
          content: 'Reply with OK only.'
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao testar o provider: ${text}`);
  }

  const payload = await response.json();
  const content = String(payload?.choices?.[0]?.message?.content ?? '').trim();

  if (content === '') {
    throw new Error('O provider respondeu sem conteudo no teste de conexao.');
  }

  return {
    ok: true,
    model: String(payload?.model ?? provider.defaultModel),
    provider: provider.provider,
    contentPreview: content
  };
}
