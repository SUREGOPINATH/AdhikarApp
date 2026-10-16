import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createApp } from "./app.js";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const { app } = createApp({
  databasePath: path.join(serverDirectory, "../data/adhikar.db"),
  distDirectory: path.join(serverDirectory, "../dist"),
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Adhikar API listening on port ${PORT}`);
  });
}