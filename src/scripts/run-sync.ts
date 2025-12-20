import dotenv from 'dotenv';
dotenv.config();

import { FullSyncJob } from '../jobs/fullSync';
import { IncrementalSyncJob } from '../jobs/incrementalSync';
import logger from '../utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const syncType = args.find(arg => arg.startsWith('--type='))?.split('=')[1];
  const resume = args.find(arg => arg.startsWith('--resume='))?.split('=')[1];

  if (!syncType || !['full', 'incremental'].includes(syncType)) {
    console.error('Usage: node dist/scripts/run-sync.js --type=<full|incremental> [--resume=<offset>]');
    process.exit(1);
  }

  try {
    if (syncType === 'full') {
      const fullSync = new FullSyncJob();
      const resumeOffset = resume ? parseInt(resume) : undefined;
      await fullSync.run(resumeOffset);
    } else {
      const incrementalSync = new IncrementalSyncJob();
      await incrementalSync.run();
    }

    logger.info('Sync completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Sync failed', { error });
    process.exit(1);
  }
}

main();
