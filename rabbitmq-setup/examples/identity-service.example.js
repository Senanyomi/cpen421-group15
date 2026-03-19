// examples/identity-service.example.js
// ─────────────────────────────────────────────────────────────────────────────
// Shows how the Identity Service wires up RabbitMQ.
// Identity only PUBLISHES — it does not consume any events.
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const express = require('express');
const { connectRabbitMQ, publish, EVENTS } = require('../src');

const app = express();
app.use(express.json());

// ── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
  await connectRabbitMQ({ service: 'identity-service' });

  app.listen(3001, () => console.log('Identity Service on :3001'));
};

// ── Route: POST /auth/register ────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const { name, email, role } = req.body;

  // ... create user in DB, hash password, generate token etc. ...
  const newUser = { id: 'user-uuid-001', name, email, role: role || 'OPERATOR' };

  // Publish so other services know a new user exists
  publish(EVENTS.USER_CREATED, {
    userId: newUser.id,
    name:   newUser.name,
    email:  newUser.email,
    role:   newUser.role,
  }, { source: 'identity-service' });

  res.status(201).json({ success: true, data: newUser });
});

// ── Route: PUT /auth/users/:id/deactivate ────────────────────────────────────
app.put('/auth/users/:id/deactivate', async (req, res) => {
  const userId = req.params.id;

  // ... deactivate in DB, revoke tokens ...

  publish(EVENTS.USER_DEACTIVATED, {
    userId,
    deactivatedBy: req.user?.userId,
  }, { source: 'identity-service' });

  res.json({ success: true, message: 'User deactivated.' });
});

start();
