import express from "express";
import { corsMiddleware } from "./src/middleware/cors";
import { limiter } from "./src/middleware/rateLimit";
import routes from "./src/routes";

const app = express();

// Trust proxy para rate-limit funcionar corretamente no Render (1 proxy à frente)
app.set("trust proxy", 1);

// CORS - allow only localhost
app.use(corsMiddleware);

app.use(express.json());

// Rate limiting by IP..
app.use("/query", limiter);

const PORT = process.env.PORT || 3000;

// Rotas
app.use(routes);

const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
