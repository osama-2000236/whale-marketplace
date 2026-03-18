async function getCsrfToken(agent, path = '/auth/login') {
  const res = await agent.get(path);
  const meta = res.text.match(/<meta name="csrf-token" content="([^"]+)"/i);
  if (meta && meta[1]) return meta[1];

  const input = res.text.match(/name="_csrf"\s+value="([^"]+)"/i);
  if (input && input[1]) return input[1];

  throw new Error(`Could not find CSRF token on ${path}`);
}

async function postWithCsrf(agent, path, body = {}, csrfPath = '/auth/login') {
  const token = await getCsrfToken(agent, csrfPath);
  return agent
    .post(path)
    .set('x-csrf-token', token)
    .send({ ...body, _csrf: token });
}

module.exports = {
  getCsrfToken,
  postWithCsrf
};
