import * as wppconnect from '@wppconnect-team/wppconnect';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Logger } from '@nestjs/common';

/**
 * Script de Health Check do Navegador para WPPConnect
 */

const WHATSAPP_WEB_URL = 'https://web.whatsapp.com';
const SCRIPT_TIMEOUT_MS = 90_000;
const logger = new Logger('BrowserHealthCheck');

async function runHealthCheck() {
  logger.log('-------------------------------------------------');
  logger.log('WPPConnect Browser Health Check');
  logger.log(`Timeout: ${SCRIPT_TIMEOUT_MS / 1000}s`);
  logger.log(`Time: ${new Date().toISOString()}`);
  logger.log('-------------------------------------------------');

  // 1. Verificar existência do binário
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';

  logger.log(`[1/5] Caminho do Chromium: ${executablePath}`);
  if (!fs.existsSync(executablePath)) {
    logger.error(`ERRO: Executável não encontrado em "${executablePath}"`);
    logger.error('Defina a variável CHROMIUM_EXECUTABLE_PATH ou instale o Chromium.');
    process.exit(1);
  }
  logger.log('Binário encontrado.');

  // 2. Versão do Chromium
  logger.log('[2/5] Verificando versão do Chromium...');
  try {
    const version = execSync(`${executablePath} --version 2>&1`).toString().trim();
    logger.log(`Versão: ${version}`);
  } catch (e) {
    logger.warn(`Não foi possível obter a versão: ${e.message}`);
  }

  // 3. Inicializar WPPConnect
  logger.log('[3/5] Inicializando WPPConnect...');

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

    logger.log('WPPConnect criado com sucesso!');

    // 4. Navegar até o WhatsApp Web
    logger.log(`[4/5] Navegando até ${WHATSAPP_WEB_URL}...`);
    const page = client.page;

    await page.goto(WHATSAPP_WEB_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const pageTitle = await page.title();
    logger.log(`Página carregada! Título: "${pageTitle}"`);

    // 5. Screenshot
    logger.log('[5/5] Gerando screenshot...');
    const screenshotPath = path.join(process.cwd(), 'browser-health-check.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    logger.log(`Screenshot salvo em: ${screenshotPath}`);

    logger.log('-------------------------------------------------');
    logger.log('HEALTH CHECK PASSOU! O motor gráfico está funcional.');
    logger.log('-------------------------------------------------');

    clearTimeout(globalTimeout);
    await client.close();
    process.exit(0);
  } catch (error) {
    clearTimeout(globalTimeout);
    logger.error('-------------------------------------------------');
    logger.error('HEALTH CHECK FALHOU!');
    logger.error('-------------------------------------------------');
    logger.error(`Mensagem de erro: ${error?.message ?? error}`);
    logger.error(`Stack trace: ${error?.stack ?? '(sem stack)'}`);

    logger.log('Dicas de diagnóstico:');
    logger.log('• Verifique se todas as libs do SO estão instaladas:');
    logger.log('  ldd $(which chromium) | grep "not found"');
    logger.log('• Teste o Chromium diretamente:');
    logger.log(`  ${executablePath} --headless --no-sandbox --dump-dom https://example.com`);
    logger.log(
      '• Ative logs detalhados: DEBUG=puppeteer:* npx ts-node scripts/browser-health-check.ts',
    );
    logger.log('• Verifique conectividade: curl -I https://web.whatsapp.com');

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
