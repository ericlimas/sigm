import { app } from "@/app";
import { env } from "@/config/env";

app.listen(env.port, () => {
  console.log(`SIGM API rodando em http://localhost:${env.port}`);
  console.log(`Ambiente: ${env.nodeEnv}`);
});
