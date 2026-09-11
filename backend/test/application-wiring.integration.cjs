require("reflect-metadata");
require("dotenv/config");
const { Test } = require("@nestjs/testing");
const { AppModule } = require("../dist/app.module");
const { PrismaService } = require("../dist/database/prisma.service");

// Compile the actual Nest dependency graph, but never initialize workers, SQL or an HTTP listener.
async function main() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  try {
    console.log("PASS: compiled application dependency graph; no SQL connection, worker initialization or HTTP listener.");
  } finally {
    await moduleRef.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Application wiring check failed");
  process.exitCode = 1;
});
