const https = require('https');
const { Client } = require('pg');

const PROJECT_REF = 'rmqirmbxawfwyrwkvndz';
const PASSWORD = '753951.Bam123Knao66';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcWlybWJ4YXdmd3lyd2t2bmR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE3NTY4MCwiZXhwIjoyMDg0NzUxNjgwfQ.VU54zM1JZdNBIoRd8ojgYTdIXn5-Dm25QI3mGvF9Qls';

// Test API
function testAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PROJECT_REF + '.supabase.co',
      path: '/rest/v1/staff?select=id&limit=1',
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('API Status:', res.statusCode);
        console.log('API Response:', data);
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', (e) => {
      console.error('API Error:', e.message);
      reject(e);
    });

    req.end();
  });
}

// Test Postgres connection
async function testPG() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const configs = [
    { region: 'sa-east-1', port: 5432 },
    { region: 'sa-east-1', port: 6543 },
    { region: 'us-east-1', port: 5432 },
    { region: 'eu-west-1', port: 5432 },
  ];

  for (const cfg of configs) {
    const client = new Client({
      host: `aws-0-${cfg.region}.pooler.supabase.com`,
      port: cfg.port,
      user: `postgres.${PROJECT_REF}`,
      password: PASSWORD,
      database: 'postgres',
      ssl: true,
      connectionTimeoutMillis: 10000
    });

    try {
      console.log(`\nTrying ${cfg.region}:${cfg.port}...`);
      await client.connect();
      console.log('CONNECTED!');

      const result = await client.query('SELECT 1 as test');
      console.log('Query result:', result.rows);

      await client.end();
      return client;
    } catch (e) {
      console.log('Failed:', e.message);
      try { await client.end(); } catch {}
    }
  }

  return null;
}

async function main() {
  console.log('=== Testing Supabase Connection ===\n');

  console.log('1. Testing REST API...');
  await testAPI();

  console.log('\n2. Testing Postgres connection...');
  const connected = await testPG();

  if (!connected) {
    console.log('\n❌ Postgres connection failed on all regions');
    console.log('The connection pooler may not be enabled for this project.');
  }
}

main().catch(console.error);
