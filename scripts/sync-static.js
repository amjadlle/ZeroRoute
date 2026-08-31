import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dash = path.join(root, "public", "dashboard.html");

if (fs.existsSync(dash)) {
  fs.mkdirSync(path.join(root, "public", "app"), { recursive: true });
  fs.copyFileSync(dash, path.join(root, "public", "app", "index.html"));

  fs.mkdirSync(path.join(root, "public", "dashboard"), { recursive: true });
  fs.copyFileSync(dash, path.join(root, "public", "dashboard", "index.html"));
}
