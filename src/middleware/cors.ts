import cors from "cors";

// CORS_ORIGINS: lista de origens permitidas, separadas por vírgulas
// Ex.: CORS_ORIGINS=https://meu-site.ao,https://app.meu-site.ao
const defaultOrigins = ["http://localhost", "http://localhost:3000", "http://127.0.0.1", "http://127.0.0.1:3000"];

const origins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : defaultOrigins;

export const corsMiddleware = cors({
  origin: origins,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
});
