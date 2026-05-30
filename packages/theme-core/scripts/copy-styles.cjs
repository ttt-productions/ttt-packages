const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const srcStylesDir = path.join(packageRoot, "src", "styles");
const distStylesDir = path.join(packageRoot, "dist", "styles");

function copyDirectoryRecursive(sourceDir, destinationDir) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destinationPath, { recursive: true });
      copyDirectoryRecursive(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function main() {
  if (!fs.existsSync(srcStylesDir)) {
    console.warn(
      `[theme-core] Warning: styles source directory not found: ${srcStylesDir}`
    );
    process.exit(0);
  }

  fs.rmSync(distStylesDir, { recursive: true, force: true });
  fs.mkdirSync(distStylesDir, { recursive: true });
  copyDirectoryRecursive(srcStylesDir, distStylesDir);
}

main();
