import "reflect-metadata";
import { rollbackDatabase } from "./helpers/rollback-database";
import { commercialProposalFlow } from "./helpers/commercial-proposal-flow";
import { commercialFilesFlow } from "./helpers/commercial-files-flow";
import { commercialControlsFlow } from "./helpers/commercial-controls-flow";

void rollbackDatabase(async (tx, db, fixture) => {
  await commercialProposalFlow(tx, db, fixture);
  await commercialFilesFlow(tx, db, fixture);
  await commercialControlsFlow(tx, db, fixture);
}).catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Commercial SQL integration failed",
  );
  process.exitCode = 1;
});
