interface AdzunaExceptionPayload {
  __CLASS__?: string;
  display?: string;
  exception?: string;
  doc?: string;
}

export function normalizeClientErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();

    if (message !== '' && message.toLowerCase() !== 'error' && message.toLowerCase() !== 'script error.') {
      return message;
    }
  }

  if (typeof error === 'string') {
    const message = error.trim();

    if (message !== '' && message.toLowerCase() !== 'error') {
      return message;
    }
  }

  if (error && typeof error === 'object') {
    const candidate = Reflect.get(error, 'message');

    if (typeof candidate === 'string' && candidate.trim() !== '' && candidate.trim().toLowerCase() !== 'error') {
      return candidate.trim();
    }

    const type = Reflect.get(error, 'type');

    if (typeof type === 'string' && type.trim() !== '') {
      return `${fallback} Tipo do erro: ${type.trim()}.`;
    }
  }

  return fallback;
}

export function assertAdzunaPayloadOk(payload: unknown): void {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  const exceptionPayload = payload as AdzunaExceptionPayload;

  if (!exceptionPayload.exception) {
    return;
  }

  if (exceptionPayload.exception === 'AUTH_FAIL') {
    throw new Error('Adzuna recusou as credenciais. Revise app_id e app_key no portal do desenvolvedor.');
  }

  throw new Error(exceptionPayload.display || `Adzuna retornou erro: ${exceptionPayload.exception}.`);
}

export function requestAdzunaJsonp<T>(url: string, timeoutMs = 12000): Promise<T> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('JSONP da Adzuna requer ambiente de navegador.'));
  }

  const callbackName = `applyforgeJsonp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const scopedWindow = window as unknown as Record<string, unknown>;
  const script = document.createElement('script');
  const separator = url.includes('?') ? '&' : '?';

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onWindowError = (event: ErrorEvent) => {
      if (settled || event.filename !== script.src) {
        return;
      }

      window.clearTimeout(timer);
      cleanup();
      reject(new Error(normalizeClientErrorMessage(
        event.error ?? event,
        'Falha ao executar o script da Adzuna no navegador. Revise as credenciais, desative bloqueadores e confirme se a conta tem acesso liberado para a API.'
      )));
    };

    const cleanup = () => {
      settled = true;
      delete scopedWindow[callbackName];
      window.removeEventListener('error', onWindowError);
      script.remove();
    };

    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }

      cleanup();
      reject(new Error('Tempo limite excedido ao consultar Adzuna via JSONP.'));
    }, timeoutMs);

    scopedWindow[callbackName] = (payload: T) => {
      if (settled) {
        return;
      }

      window.clearTimeout(timer);
      cleanup();
      resolve(payload);
    };

    script.async = true;
    script.type = 'text/javascript';
    window.addEventListener('error', onWindowError);
    script.onerror = () => {
      if (settled) {
        return;
      }

      window.clearTimeout(timer);
      cleanup();
      reject(new Error('Falha ao carregar a resposta da Adzuna. Isso normalmente indica credenciais invalidas, conta sem liberacao para a API, ou bloqueio do navegador/extensao.'));
    };
    script.src = `${url}${separator}content-type=text/javascript&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}
