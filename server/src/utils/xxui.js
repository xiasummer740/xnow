import axios from 'axios';
import crypto from 'crypto';

function newClientEmail(productId, userId) {
  const shortId = crypto.randomBytes(4).toString('hex');
  return `u${userId}_p${productId}_${shortId}`;
}

function newClientUUID() {
  return crypto.randomUUID();
}

export async function createXXUIClient(baseUrl, apiKey, inboundId, email, uuid, totalGB, expiryTime) {
  const url = `${baseUrl}/panel/remote/inbound/${inboundId}/client`;
  const payload = {
    clientStats: [{
      email,
      enable: true,
      up: 0,
      down: 0,
      expiryTime,
      total: totalGB * 1073741824, // GB to bytes
      uuid
    }],
    settings: JSON.stringify({
      clients: [{
        id: uuid,
        email: email,
        flow: ""
      }]
    })
  };

  const { data } = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    timeout: 15000
  });

  if (!data.success) {
    throw new Error(data.msg || 'Failed to create client on remote panel');
  }
  return data.obj?.inbound || data.obj;
}

export async function getXXUIClient(baseUrl, apiKey, email) {
  const url = `${baseUrl}/panel/remote/client/${email}`;
  const { data } = await axios.get(url, {
    headers: { 'X-API-Key': apiKey },
    timeout: 10000
  });
  if (!data.success) {
    throw new Error(data.msg || 'Failed to fetch client info');
  }
  return data.obj;
}

export async function updateXXUIClient(baseUrl, apiKey, email, totalGB, expiryTime, enable) {
  const url = `${baseUrl}/panel/remote/client/${email}/traffic`;
  const payload = { totalGB, expiryTime, enable };
  const { data } = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    timeout: 10000
  });
  if (!data.success) {
    throw new Error(data.msg || 'Failed to update client');
  }
  return data;
}

export async function listXXUIInbounds(baseUrl, apiKey) {
  const url = `${baseUrl}/panel/remote/inbounds`;
  const { data } = await axios.get(url, {
    headers: { 'X-API-Key': apiKey },
    timeout: 10000
  });
  if (!data.success) {
    throw new Error(data.msg || 'Failed to list inbounds');
  }
  return data.obj;
}

export { newClientEmail, newClientUUID };
