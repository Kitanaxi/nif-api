import puppeteer from "puppeteer";
import { NifData } from "../types";

/**
 * Consulta NIF/BI no Portal do Contribuinte
 */
export async function consultarNif(nif: string): Promise<NifData> {
  const isProduction = process.env.NODE_ENV === "production";
  
  let browser;
  
  if (isProduction) {
    // No Render/cloud, usa @sparticuz/chromium
    const chromium = require("@sparticuz/chromium");
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    // Localmente, usa o Puppeteer padrão
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }

  try {
    const page = await browser.newPage();

    // Bloquear imagens, CSS e fontes para ser mais rápido
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const tipo = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(tipo)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(
      "https://portaldocontribuinte.minfin.gov.ao/consultar-nif-do-contribuinte",
      {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }
    );

    // Aguarda o campo do NIF aparecer
    await page.waitForSelector("#j_id_2x\\:txtNIFNumber", { timeout: 20000 });

    // Limpa e digita o NIF
    await page.click("#j_id_2x\\:txtNIFNumber");
    await page.type("#j_id_2x\\:txtNIFNumber", nif, { delay: 30 });

    // Clica em Pesquisar
    await page.click("#j_id_2x\\:j_id_34");

    // Espera o resultado aparecer
    await page.waitForSelector("div.panel-default-header", {
      timeout: 15000,
    });

    // Extrai os dados
    const dados = await page.evaluate(() => {
      const getText = (selector: string): string | null => {
        const el = document.querySelector(selector);
        return el ? el.textContent?.trim() || null : null;
      };

      return {
        nif: getText("#taxPayerNidId") || "",
        name: getText("div.form-group:nth-child(3) .col-sm-6:last-child label") || "",
        type: getText("div.form-group:nth-child(4) .col-sm-6:last-child label") || "",
        status: getText("div.form-group:nth-child(5) .col-sm-6:last-child label") || "",
        vatRegime: getText("div.form-group:nth-child(6) .col-sm-6:last-child label") || "",
        taxResidence: getText(
          "div.form-group:nth-child(7) .col-sm-6:last-child label"
        ) || "",
      };
    });

    // Validação básica
    if (!dados.name || !dados.nif) {
      throw new Error("NIF not found or incomplete data");
    }

    return dados;
  } finally {
    await browser.close();
  }
}
