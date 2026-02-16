import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

async function clearAccounts() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  const keys = await redis.keys('usmm:account:*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Deleted ${keys.length} account keys.`);
  } else {
    console.log('No account keys found.');
  }

  // Also clear task index if that was intended as part of "all accounts/tasks"
  await redis.del('usmm:tasks_index');
  
  // Also delete the actual task hashes
  const taskKeys = await redis.keys('usmm:task:*');
  if (taskKeys.length > 0) {
    await redis.del(...taskKeys);
    console.log(`Deleted ${taskKeys.length} task keys.`);
  }

  console.log('Redis account and task data cleared.');
  await redis.quit();
}

clearAccounts().catch(console.error);
