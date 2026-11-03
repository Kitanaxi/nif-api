const { join } = require("path");

/**
 * Guarda o Chrome dentro do projeto para que o download feito no build
 * esteja disponível no runtime (no Render, /opt/render/.cache não persiste).
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
