import http from 'k6/http';
import { check, sleep } from 'k6';

const vus = Number(__ENV.VUS) || 20;
const duration = __ENV.DURATION || '2m';

export const options = {
  vus,
  duration,
};

export default function () {
  const res = http.get('https://192.168.10.139:9443/api', {
    timeout: '60s',
  });

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  sleep(1);
}