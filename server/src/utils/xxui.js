import axios from 'axios';
import crypto from 'crypto';

function normUrl(u) {
  return (u || '').replace(/\/+$/, '');
}

function newClientEmail(productId, userId) {
  const shortId = crypto.randomBytes(4).toString('hex');
  return `u${userId}_p${productId}_${shortId}`;
}

function newClientUUID() {
  return crypto.randomUUID();
}

export async function createXXUIClient(baseUrl, apiKey, inboundId, email, uuid, subId, totalGB, expiryTime) {
  const url = `${normUrl(baseUrl)}/panel/remote/inbound/${inboundId}/client`;
  const totalBytes = totalGB * 1073741824;
  const payload = {
    settings: JSON.stringify({
      clients: [{
        id: uuid,
        email: email,
        subId: subId,
        flow: "",
        totalGB: totalBytes,
        expiryTime: expiryTime,
        enable: true
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
  const url = `${normUrl(baseUrl)}/panel/remote/client/${email}`;
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
  const url = `${normUrl(baseUrl)}/panel/remote/client/${email}/traffic`;
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
