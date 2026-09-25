import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('custom_error_rate');
const edgeFunctionLatency = new Trend('edge_function_latency');
const postgrestLatency = new Trend('postgrest_latency');
const webAppLatency = new Trend('web_app_latency');

export const options = {
  scenarios: {
    concurrent_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 25 },  // Warmup ramp
        { duration: '20s', target: 60 },  // Sustained burst
        { duration: '15s', target: 100 }, // Surge to 100 concurrent VUs
        { duration: '15s', target: 100 }, // Hold peak 100 concurrent VUs
        { duration: '10s', target: 0 },   // Graceful cooldown
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'], // Less than 2% HTTP failures
    http_req_duration: ['p(95)<1500'], // 95% of requests completed within 1.5s
    custom_error_rate: ['rate<0.02'],
  },
};

const BASE_WEB_URL = 'http://localhost:3000';
const SUPABASE_URL = 'https://vjlsuadvxjmxrwnqytmu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqbHN1YWR2eGpteHJ3bnF5dG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODU1MjYsImV4cCI6MjEwMzQ2MTUyNn0.t_HOrPvULI_87Q4MQbGXx9qP4hO7tK-nPjgA_SvlLys';
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY || '';

// Minimal valid ASCII STL binary simulation for virus scanner
const MOCK_STL_BASE64 = 'c29saWQgbW9ja190cmlhbmdsZQpmYWNldCBub3JtYWwgMCAwIDAKb3V0ZXIgbG9vcAp2ZXJ0ZXggMCAwIDAKdmVydGV4IDEgMCAwCnZlcnRleCAwIDEgMAplbmRsb29wCmVuZGZhY2V0CmVuZHNvbGlkIG1vY2tfdHJpYW5nbGU=';

export default function () {
  const rand = Math.random();

  if (rand < 0.30) {
    // 1. Marketplace catalog browse
    const res = http.get(`${BASE_WEB_URL}/models`, {
      tags: { name: 'WebApp_ModelsCatalog' },
    });
    webAppLatency.add(res.timings.duration);
    const pass = check(res, {
      'models status is 200': (r) => r.status === 200,
    });
    errorRate.add(!pass);
  } else if (rand < 0.50) {
    // 2. Individual Model Page SSR (with 3D viewer bootstrap)
    const res = http.get(`${BASE_WEB_URL}/models/83c8025c-b172-4013-9edb-4f015d95a107`, {
      tags: { name: 'WebApp_ModelDetail' },
    });
    webAppLatency.add(res.timings.duration);
    const pass = check(res, {
      'model detail status is 200': (r) => r.status === 200,
    });
    errorRate.add(!pass);
  } else if (rand < 0.70) {
    // 3. Mart instant print quoter landing
    const res = http.get(`${BASE_WEB_URL}/mart`, {
      tags: { name: 'WebApp_MartQuoter' },
    });
    webAppLatency.add(res.timings.duration);
    const pass = check(res, {
      'mart status is 200': (r) => r.status === 200,
    });
    errorRate.add(!pass);
  } else if (rand < 0.85) {
    // 4. Freelancer directory
    const res = http.get(`${BASE_WEB_URL}/freelance`, {
      tags: { name: 'WebApp_Freelance' },
    });
    webAppLatency.add(res.timings.duration);
    const pass = check(res, {
      'freelance status is 200': (r) => r.status === 200,
    });
    errorRate.add(!pass);
  } else if (rand < 0.95) {
    // 5. Direct PostgREST query (testing DB pool multiplexing from client)
    const headers = {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    };
    const res = http.get(
      `${SUPABASE_URL}/rest/v1/models?select=id,title,category,status&status=eq.published`,
      { headers, tags: { name: 'PostgREST_Models' } }
    );
    postgrestLatency.add(res.timings.duration);
    const pass = check(res, {
      'postgrest status is 200': (r) => r.status === 200,
    });
    errorRate.add(!pass);
  } else {
    // 6. Supabase Edge Function: model-virus-scanner concurrency
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
    };
    const payload = JSON.stringify({
      filename: 'load_test_cube.stl',
      fileBase64: MOCK_STL_BASE64,
    });
    const res = http.post(
      `${SUPABASE_URL}/functions/v1/model-virus-scanner`,
      payload,
      { headers, tags: { name: 'EdgeFunction_VirusScanner' } }
    );
    edgeFunctionLatency.add(res.timings.duration);
    const pass = check(res, {
      'edge function status is 200': (r) => r.status === 200,
      'edge function reports safe': (r) => {
        try {
          return JSON.parse(r.body).safe === true;
        } catch (_) {
          return false;
        }
      },
    });
    errorRate.add(!pass);
  }

  // Realistic user pacing between actions (100ms - 300ms)
  sleep(0.1 + Math.random() * 0.2);
}
