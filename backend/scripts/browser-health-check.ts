import * as wppconnect from '@wppconnect-team/wppconnect';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { AppLoggerService } from '@/shared/services/logger.service';
import { LogSeverity } from '@/shared/interfaces/logger.interface';

/**
 * Script de Health Check do Navegador para WPPConnect
 */

const WHATSAPP_WEB_URL = 'https://web.whatsapp.com';
const SCRIPT_TIMEOUT_MS = 90_000;
const logger = new AppLoggerService().forContext('BrowserHealthCheck');

async function runHealthCheck() {
  logger.log(
    `WPPConnect Browser Health Check | timeout=${SCRIPT_TIMEOUT_MS / 1000}s | ${new Date().toISOString()}`,
  );

  // 1. Verificar existência do binário
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';

  if (!fs.existsSync(executablePath)) {
    logger.error(`ERRO: Executável não encontrado em "${executablePath}"`);
    logger.error('Defina a variável CHROMIUM_EXECUTABLE_PATH ou instale o Chromium.');
    process.exit(1);
  }
  logger.log(`[1/5] Chromium encontrado: ${executablePath}`);

  // 2. Versão do Chromium
  try {
    const version = execSync(`${executablePath} --version 2>&1`).toString().trim();
    logger.log(`[2/5] Chromium: ${version}`);
  } catch (e) {
    logger.warn(`Não foi possível obter a versão: ${e.message}`);
  }

  // 3. Inicializar WPPConnect
  const globalTimeout = setTimeout(() => {
    logger.error(
      `TIMEOUT após ${SCRIPT_TIMEOUT_MS / 1000}s. O Chromium travou ou a rede está bloqueada.`,
    );
    process.exit(1);
  }, SCRIPT_TIMEOUT_MS);

  let client: wppconnect.Whatsapp | null = null;

  try {
    client = await wppconnect.create({
      session: 'health-check',
      headless: true,
      useChrome: false,
      updatesLog: true,
      debug: true,
      logQR: false,
      waitForLogin: false,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--mute-audio',
      ],
      puppeteerOptions: { executablePath },
      statusFind: (statusSession, session) => {
        logger.log(`[statusFind] session=${session} -> status=${statusSession}`);
      },
    });

    logger.log('[3/5] WPPConnect criado com sucesso!');

    // 4. Navegar até o WhatsApp Web
    const page = client.page;

    await page.goto(WHATSAPP_WEB_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const pageTitle = await page.title();
    logger.log(`[4/5] Página carregada: "${pageTitle}" (${WHATSAPP_WEB_URL})`);

    // 5. Screenshot
    const screenshotPath = path.join(process.cwd(), 'browser-health-check.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    logger.log(`[5/5] Screenshot salvo: ${screenshotPath}`);

    logger.log('HEALTH CHECK PASSOU — motor gráfico funcional.');

    clearTimeout(globalTimeout);
    await client.close();
    process.exit(0);
  } catch (error) {
    clearTimeout(globalTimeout);
    logger.error({
      severity: LogSeverity.ERROR,
      message: `HEALTH CHECK FALHOU — ${error?.message ?? error}`,
      stack: (error as Error)?.stack,
    });
    logger.warn(
      [
        'Dicas de diagnóstico:',
        '• Verifique libs do SO: ldd $(which chromium) | grep "not found"',
        `• Teste o Chromium: ${executablePath} --headless --no-sandbox --dump-dom https://example.com`,
        '• Logs detalhados: DEBUG=puppeteer:* npx ts-node scripts/browser-health-check.ts',
        '• Conectividade: curl -I https://web.whatsapp.com',
      ].join('\n'),
    );

    if (client) {
      try {
        await client.close();
      } catch (_) {
        /* ignora */
      }
    }
    process.exit(1);
  }
}

runHealthCheck();
