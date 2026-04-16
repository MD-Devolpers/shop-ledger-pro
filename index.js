const { spawn } = require("child_process");

const proc = spawn("sh", ["start-railway.sh"], { stdio: "inherit" });
proc.on("exit", (code) => process.exit(code ?? 0));
