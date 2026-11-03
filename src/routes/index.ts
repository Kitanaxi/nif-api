import { Router, Request, Response } from "express";
import { consultarNif } from "../services/nifService";
import { retry } from "../services/retry";
import { getFromCache, saveToCache } from "../services/cache";

const router = Router();

// Rota principal
router.post("/query", async (req: Request, res: Response) => {
  const { nif } = req.body;

  if (!nif || typeof nif !== "string") {
    return res.status(400).json({
      success: false,
      message: "The 'nif' field is required",
    });
  }

  const nifLimpo = nif.trim().toUpperCase();

  // Verifica cache primeiro
  const cached = getFromCache(nifLimpo);
  if (cached) {
    console.log(`Cache hit for NIF: ${nifLimpo}`);
    return res.json({
      success: true,
      data: cached,
      cached: true,
    });
  }

  try {
    const resultado = await retry(() => consultarNif(nifLimpo), 3, 2000);

    // Salva no cache
    saveToCache(nifLimpo, resultado);

    return res.json({
      success: true,
      data: resultado,
      cached: false,
    });
  } catch (error) {
    console.error("Erro na consulta:", (error as Error).message);

    return res.status(404).json({
      success: false,
      message: "NIF not found or portal unavailable",
      error: (error as Error).message,
    });
  }
});

// Rota de saúde
router.get("/", (req: Request, res: Response) => {
  res.json({
    status: "online",
    message: "NIF/BI Query API - Angola",
    endpoint: "POST /query",
    example: { nif: "003519344HA042" },
    cacheTTL: "5 minutes",
    maxRetries: 3,
  });
});

export default router;
