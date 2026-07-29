import sse from 'k6/x/sse';

export default function () {
  const url = 'http://localhost:3000/api/survey-responses/stream?limit=5';
  sse.open(url, {}, function (client) {
    client.on('open', function () {
      console.log('SSE OPEN');
    });
    client.on('event', function (event) {
      console.log('SSE EVENT name="' + event.name + '" data=' + (event.data ? event.data.slice(0, 80) : '(empty)'));
      if (event.name === 'snapshot') client.close();
    });
    client.on('error', function (e) {
      console.log('SSE ERROR', e.error());
    });
  });
}
