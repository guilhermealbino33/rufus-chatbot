import * as wppconnect from '@wppconnect-team/wppconnect';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Script de Health Check do Navegador para WPPConnect
 *
 * Valida, em ordem:
 *  1. Existência do binário do Chromium
 *  2. Versão do Chromium instalado
 *  3. Inicialização do WPPConnect (Puppeteer + Chromium headless)
 *  4. Navegação até o WhatsApp Web (confirma conectividade de rede)
 *  5. Screenshot da página (confirma renderização gráfica)
 *  6. Ciclo de vida da sessão via statusFind
 *
 * Uso:
 *   npx ts-node scripts/browser-health-check.ts
 *
 * Variáveis de ambiente relevantes:
 *   CHROMIUM_EXECUTABLE_PATH  - caminho para o binário (default: /usr/bin/chromium)
 *   DEBUG=puppeteer:*         - habilita logs detalhados do Puppeteer
 */

const WHATSAPP_WEB_URL = 'https://web.whatsapp.com';
// Timeout global para o script inteiro (ms). PaaS pode ser lento.
const SCRIPT_TIMEOUT_MS = 90_000;

async function runHealthCheck() {
  console.log('═══════════════════════════════════════════════');
  console.log('🚀  WPPConnect Browser Health Check');
  console.log(`⏱️  Timeout: ${SCRIPT_TIMEOUT_MS / 1000}s`);
  console.log(`🕐  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════');

  // ── 1. Verificar existência do binário ─────────────────────────────────────
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';

  console.log(`\n[1/5] 📂  Caminho do Chromium: ${executablePath}`);
  if (!fs.existsSync(executablePath)) {
    console.error(`❌  ERRO: Executável não encontrado em "${executablePath}"`);
    console.error('    Defina a variável CHROMIUM_EXECUTABLE_PATH ou instale o Chromium.');
    process.exit(1);
  }
  console.log('     ✅  Binário encontrado.');

  // ── 2. Versão do Chromium ───────────────────────────────────────────────────
  console.log('\n[2/5] 🔍  Verificando versão do Chromium...');
  try {
    const version = execSync(`${executablePath} --version 2>&1`).toString().trim();
    console.log(`     ✅  ${version}`);
  } catch (e) {
    console.warn(`     ⚠️  Não foi possível obter a versão: ${e.message}`);
  }

  // ── 3. Inicializar WPPConnect ───────────────────────────────────────────────
  console.log('\n[3/5] 🔧  Inicializando WPPConnect...');

  // Timer global para evitar que o script trave para sempre
  const globalTimeout = setTimeout(() => {
    console.error(
      `\n❌  TIMEOUT após ${SCRIPT_TIMEOUT_MS / 1000}s. O Chromium travou ou a rede está bloqueada.`,
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
      // waitForLogin: false → não tentamos fazer login, só queremos que o browser abra
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
        console.log(`     📡  [statusFind] session=${session} → status=${statusSession}`);
      },
    });

    console.log('     ✅  WPPConnect criado com sucesso!');

    // ── 4. Navegar até o WhatsApp Web ─────────────────────────────────────────
    console.log(`\n[4/5] 🌐  Navegando até ${WHATSAPP_WEB_URL}...`);
    const page = client.page;

    await page.goto(WHATSAPP_WEB_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const pageTitle = await page.title();
    console.log(`     ✅  Página carregada! Título: "${pageTitle}"`);

    // ── 5. Screenshot ─────────────────────────────────────────────────────────
    console.log('\n[5/5] 📸  Tirando screenshot...');
    const screenshotPath = path.join(process.cwd(), 'browser-health-check.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`     ✅  Screenshot salvo em: ${screenshotPath}`);

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉  HEALTH CHECK PASSOU! O motor gráfico está funcional.');
    console.log('═══════════════════════════════════════════════\n');

    clearTimeout(globalTimeout);
    await client.close();
    process.exit(0);
  } catch (error) {
    clearTimeout(globalTimeout);
    console.error('\n═══════════════════════════════════════════════');
    console.error('❌  HEALTH CHECK FALHOU!');
    console.error('═══════════════════════════════════════════════');
    console.error('Mensagem de erro:', error?.message ?? error);
    console.error('\nStack trace:');
    console.error(error?.stack ?? '(sem stack)');

    console.error('\n💡  Dicas de diagnóstico:');
    console.error('    • Verifique se todas as libs do SO estão instaladas:');
    console.error('      ldd $(which chromium) | grep "not found"');
    console.error('    • Teste o Chromium diretamente:');
    console.error(`      ${executablePath} --headless --no-sandbox --dump-dom https://example.com`);
    console.error(
      '    • Ative logs detalhados: DEBUG=puppeteer:* npx ts-node scripts/browser-health-check.ts',
    );
    console.error('    • Verifique conectividade: curl -I https://web.whatsapp.com');

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
