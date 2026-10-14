/**
 * test_chatbot_deepseek.js — Automated test suite for Ceramic AI DeepSeek Chatbot
 * Tests API handlers, schemas, multi-turn reasoning, and safety.
 */

import assert from 'assert';
import chatHandler from './FE/api/ai/chat.js';
import healthHandler from './FE/api/ai/health.js';

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
  }
  setHeader(key, value) {
    this.headers[key] = value;
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  json(data) {
    this.body = data;
    return this;
  }
  end() {
    return this;
  }
}

async function runTests() {
  console.log('=== STARTING CERAMIC AI DEEPSEEK TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`✗ FAIL: ${name} ->`, e.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`✗ FAIL: ${name} ->`, e.message);
      failed++;
    }
  }

  // TEST 1: Health check endpoint format
  await testAsync('Health endpoint returns valid status without leaking secrets', async () => {
    const req = { method: 'GET' };
    const res = new MockResponse();
    healthHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.provider, 'deepseek');
    assert.strictEqual(typeof res.body.keyConfigured, 'boolean');
    assert.strictEqual(res.body.apiKey, undefined, 'API key must not be exposed');
  });

  // TEST 2: OPTIONS preflight CORS support
  await testAsync('Chat handler handles OPTIONS preflight', async () => {
    const req = { method: 'OPTIONS' };
    const res = new MockResponse();
    await chatHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['Access-Control-Allow-Origin'], '*');
  });

  // TEST 3: Reject non-POST methods
  await testAsync('Chat handler rejects GET method with 405', async () => {
    const req = { method: 'GET' };
    const res = new MockResponse();
    await chatHandler(req, res);
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 4: Reject empty message with 400
  await testAsync('Chat handler rejects empty message with 400', async () => {
    const req = { method: 'POST', body: { message: '' } };
    const res = new MockResponse();
    await chatHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'EMPTY_MESSAGE');
  });

  // TEST 5: Honest status when API key is missing (No fake answers!)
  await testAsync('Chat handler reports honest 503 error when DEEPSEEK_API_KEY is missing', async () => {
    const origKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    const req = { method: 'POST', body: { message: 'Tôi muốn làm bình hoa 30cm' } };
    const res = new MockResponse();
    await chatHandler(req, res);

    process.env.DEEPSEEK_API_KEY = origKey;

    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'MISSING_API_KEY');
    assert.ok(res.body.reply.includes('DEEPSEEK_API_KEY'), 'Honest error must mention missing configuration');
  });

  // TEST 6: Mock DeepSeek API response parsing
  await testAsync('Chat handler correctly parses structured spec from DeepSeek upstream', async () => {
    const origKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'mock-key-for-test';

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: 'Tuyệt vời! Tôi đã lập đặc tả kỹ thuật cho bình hoa 30cm men xanh đồng Vert de Biên Hòa.',
                suggestions: ['Mở trong Xưởng 3D', 'Xem trước thông số', 'Đổi màu men'],
                spec: {
                  ready: true,
                  archetype: 'vase',
                  archetypeName: 'Bình hoa',
                  heightCm: 30,
                  diameterCm: 14,
                  glazeName: 'Men Xanh Đồng Trổ (Vert de Biên Hòa)',
                  glazeHex: '#2A6B5C',
                  pattern: 'cuc_day',
                  customText: '',
                },
                booking: { ready: false },
              }),
            },
          },
        ],
      }),
    });

    const req = {
      method: 'POST',
      body: {
        message: 'Tôi muốn bình hoa thân thon dài, cao 30cm, men xanh đồng',
        history: [],
      },
    };
    const res = new MockResponse();
    await chatHandler(req, res);

    // Restore
    globalThis.fetch = origFetch;
    process.env.DEEPSEEK_API_KEY = origKey;

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.provider, 'deepseek');
    assert.strictEqual(res.body.specReady, true);
    assert.strictEqual(res.body.spec.heightCm, 30);
    assert.strictEqual(res.body.spec.archetype, 'vase');
    assert.strictEqual(res.body.spec.glazeHex, '#2A6B5C');
  });

  // TEST 7: Mock DeepSeek API booking parsing
  await testAsync('Chat handler correctly parses workshop booking draft', async () => {
    const origKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'mock-key-for-test';

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: 'Dạ, xưởng gốm Tân Vạn có các ca trải nghiệm chiều thứ Bảy cho nhóm 3 người. Bạn có muốn chuyển sang trang Đặt lịch để chọn khung giờ cụ thể?',
                suggestions: ['Chuyển sang trang Đặt lịch', 'Chi phí workshop bao nhiêu?', 'Thời gian nung lò rồng'],
                spec: { ready: false },
                booking: {
                  ready: true,
                  type: 'workshop',
                  partySize: 3,
                  preferredDate: '2026-10-17',
                  timeSlot: 'ca_chieu',
                },
              }),
            },
          },
        ],
      }),
    });

    const req = {
      method: 'POST',
      body: {
        message: 'Đặt workshop 3 người thứ Bảy này, chiều',
        history: [{ sender: 'user', text: 'Tôi muốn ghé xưởng Tân Vạn' }],
      },
    };
    const res = new MockResponse();
    await chatHandler(req, res);

    globalThis.fetch = origFetch;
    process.env.DEEPSEEK_API_KEY = origKey;

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.booking.ready, true);
    assert.strictEqual(res.body.booking.type, 'workshop');
    assert.strictEqual(res.body.booking.partySize, 3);
  });

  // TEST 8: Upstream 401 Unauthorized handling
  await testAsync('Chat handler handles upstream 401 without crashing or faking answer', async () => {
    const origKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'invalid-key';

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const req = { method: 'POST', body: { message: 'Xin chào' } };
    const res = new MockResponse();
    await chatHandler(req, res);

    globalThis.fetch = origFetch;
    process.env.DEEPSEEK_API_KEY = origKey;

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'UPSTREAM_401');
    assert.ok(res.body.reply.includes('không hợp lệ'), 'Error message should clearly state invalid key');
  });

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
